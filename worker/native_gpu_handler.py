"""Content-addressed native Blender frame rendering; never claims episode completion."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile


def validated_input(payload):
    operation = payload.get('operation')
    if operation == 'CHECK_GPU_ACCESS':
        return {'operation': operation}
    if operation != 'RENDER_NATIVE_FRAMES':
        raise ValueError('Unknown native render operation')
    key, digest = payload.get('scene_key', ''), payload.get('scene_sha256', '')
    if not re.fullmatch(r'native/S1E1/[A-Za-z0-9_./-]+\.blend', key) or '..' in key:
        raise ValueError('Scene must belong to the project native/S1E1 prefix')
    if not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise ValueError('Source checksum required')
    start, end = payload.get('frame_start'), payload.get('frame_end')
    if type(start) is not int or type(end) is not int or start < 1 or not 1 <= end-start+1 <= 360:
        raise ValueError('A job must contain 1 to 360 consecutive authored frames')
    width, height = payload.get('width', 2560), payload.get('height', 1440)
    if (width, height) not in [(1920, 1080), (2560, 1440), (3840, 2160)]:
        raise ValueError('Only full HD or greater native output is supported')
    samples = payload.get('samples', 128)
    if type(samples) is not int or not 48 <= samples <= 512:
        raise ValueError('Samples must be between 48 and 512')
    return dict(operation=operation, scene_key=key, scene_sha256=digest,
                frame_start=start, frame_end=end, width=width, height=height, samples=samples)


def handler(event):
    job = validated_input(event.get('input', {}))
    with tempfile.TemporaryDirectory(prefix='wonderly-native-') as tmp:
        root = Path(tmp)
        if job['operation'] != 'CHECK_GPU_ACCESS':
            import boto3
            client = boto3.client('s3', endpoint_url=os.environ['S3_ENDPOINT'], region_name='auto',
                                  aws_access_key_id=os.environ['S3_ACCESS_KEY_ID'],
                                  aws_secret_access_key=os.environ['S3_SECRET_ACCESS_KEY'])
            bucket = os.environ['S3_BUCKET']
            source = root/'source.blend'
            info = client.head_object(Bucket=bucket, Key=job['scene_key'])
            if info['ContentLength'] > 1_000_000_000:
                raise ValueError('Source exceeds native scene size bound')
            client.download_file(bucket, job['scene_key'], str(source))
            with source.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if digest != job['scene_sha256']:
                raise ValueError('Native scene checksum mismatch')
            job.update(scene=str(source), output=str(root/'frames'))
        config = root/'job.json'
        config.write_text(json.dumps(job))
        process = subprocess.run([
            'blender', '--background', '--disable-autoexec', '--python',
            str(Path(__file__).with_name('native_gpu_scene.py')), '--', str(config),
        ], capture_output=True, text=True, timeout=1700)
        if process.returncode:
            raise RuntimeError('Native GPU render failed: '+process.stdout[-2500:]+process.stderr[-1000:])
        records = [json.loads(line.removeprefix('WONDERLY_NATIVE_RESULT '))
                   for line in process.stdout.splitlines() if line.startswith('WONDERLY_NATIVE_RESULT ')]
        if len(records) != 1:
            raise RuntimeError('Native renderer did not return a verified result')
        result = records[0]
        if job['operation'] != 'CHECK_GPU_ACCESS':
            identity = hashlib.sha256(json.dumps({k: v for k, v in job.items()
                                                  if k not in ('scene', 'output')}, sort_keys=True).encode()).hexdigest()
            prefix = f"renders/native/S1E1/{job['scene_sha256']}/{identity}"
            outputs = []
            for frame in range(job['frame_start'], job['frame_end']+1):
                source = root/'frames'/f'frame_{frame:06d}.png'
                data = source.read_bytes()
                if not data.startswith(b'\x89PNG\r\n\x1a\n') or not data.endswith(b'IEND\xaeB`\x82'):
                    raise RuntimeError('Incomplete native render frame')
                key = f'{prefix}/{source.name}'
                client.upload_file(str(source), bucket, key, ExtraArgs={'ContentType': 'image/png'})
                outputs.append({'frame': frame, 'key': key, 'sha256': hashlib.sha256(data).hexdigest()})
            result.update(outputs=outputs, source_sha256=job['scene_sha256'])
            movie = root/'frames'/'clip.mp4'
            audio = root/'frames'/'scene_audio.wav'
            command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                       '-framerate', '24', '-start_number', str(job['frame_start']),
                       '-i', str(root/'frames'/'frame_%06d.png')]
            if audio.exists(): command += ['-i', str(audio)]
            command += ['-frames:v', str(job['frame_end']-job['frame_start']+1),
                        '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p']
            if audio.exists(): command += ['-c:a', 'aac', '-b:a', '192k']
            command += ['-movflags', '+faststart', str(movie)]
            subprocess.run(command, check=True, capture_output=True, timeout=180)
            probe = subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0',
                                    '-show_entries','stream=width,height,r_frame_rate,nb_read_frames',
                                    '-of','json',str(movie)],check=True,capture_output=True,text=True,timeout=180)
            stream = json.loads(probe.stdout)['streams'][0]
            numerator, denominator = map(int,stream['r_frame_rate'].split('/'))
            fps = numerator/denominator
            count = int(stream['nb_read_frames'])
            if (count, fps, stream['width'], stream['height']) != (job['frame_end']-job['frame_start']+1,24,job['width'],job['height']):
                raise RuntimeError('Encoded native video failed frame/dimension verification')
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(movie),'-f','null','-'],check=True,capture_output=True,timeout=180)
            key=f'{prefix}/clip.mp4'
            client.upload_file(str(movie), bucket, key, ExtraArgs={'ContentType':'video/mp4'})
            result['clip']={'key':key,'sha256':hashlib.sha256(movie.read_bytes()).hexdigest(),
                            'bytes':movie.stat().st_size,'has_scene_audio':audio.exists(),
                            'verified_frames':count,'verified_fps':fps,
                            'verified_width':stream['width'],'verified_height':stream['height']}
        return result


if __name__ == '__main__':
    import runpod
    runpod.serverless.start({'handler': handler})
