"""Assemble only verified V025 diagnostics, retaining the frozen HU soundtrack.

This creates a clearly labelled 22-second technical reel, never a story master.
There are no provider submissions or paid render operations in this script.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

import boto3


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def run(*args):
    subprocess.run(args, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--credentials', required=True, type=Path)
    parser.add_argument('--original-movie', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Existing review must be reused, not reassembled')
    original_sha = 'a76eec569f2d81da981aac2db3ead7f7a4e30fe9dc7b195af705cd13cc95ade8'
    if digest(args.original_movie) != original_sha:
        raise ValueError('Frozen V024 movie/audio source mismatch')
    doc = json.loads(args.manifest.read_text())
    selection = [
        ('V025_faces_final', 0., 192, 'Arcok, pislogás, oldalnézet'),
        ('V025_grip_final', 79., 144, 'Csillagszilánk: felvétel és tartás'),
        ('V025_gait', 5., 192, 'Járás, fordulás és megállás'),
    ]
    if doc['version'] != 'V025' or doc['production_approved'] is not False:
        raise ValueError('Only unapproved V025 diagnostics accepted')
    jobs = {j['scene_id']: j for j in doc['jobs']}
    for name, _, frames, _ in selection:
        j = jobs[name]
        if j['status'] != 'COMPLETED' or j['clip']['verified_frames'] != frames:
            raise ValueError(f'{name} is not complete and verified')
    c = json.loads(args.credentials.read_text())
    s3 = boto3.client('s3', endpoint_url=c['S3_ENDPOINT'],
                      aws_access_key_id=c['S3_ACCESS_KEY_ID'],
                      aws_secret_access_key=c['S3_SECRET_ACCESS_KEY'])
    folder = args.output.parent / 'v025-review-parts'
    folder.mkdir(parents=True, exist_ok=True)
    inputs = []
    filters = []
    evidence = []
    for index, (name, audio_start, frames, label) in enumerate(selection):
        clip = jobs[name]['clip']
        source = folder / (name + '.mp4')
        if not source.exists():
            s3.download_file(c['S3_BUCKET'], clip['key'], str(source))
        if digest(source) != clip['sha256']:
            raise ValueError(f'{name} checksum mismatch')
        title = folder / (name + '.txt')
        title.write_text('V025 MŰSZAKI PRÓBA – NEM VÉGLEGES\n' + label)
        overlay = (f'drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:'
                   f'textfile={title}:fontcolor=white:fontsize=26:x=24:y=18:'
                   'box=1:boxcolor=black@0.65:boxborderw=10:line_spacing=6')
        inputs.extend(['-i', str(source)])
        filters.append(f'[{index}:v]trim=end_frame={frames},setpts=PTS-STARTPTS,{overlay}[v{index}]')
        filters.append(f'[a{index}]atrim=start={audio_start}:end={audio_start+frames/24},asetpts=PTS-STARTPTS[t{index}]')
        evidence.append({'scene_id': name, 'job_id': jobs[name]['id'],
                         'native_source_sha256': jobs[name]['input']['scene_sha256'],
                         'clip_sha256': clip['sha256'], 'frames': frames,
                         'original_audio_start_seconds': audio_start})
    # One continuous audio encode avoids per-clip AAC priming gaps. Video uses
    # the native frames in order: no duplicated/interpolated frames or padding.
    filters.insert(0, '[3:a]asplit=3[a0][a1][a2]')
    filters.extend(['[v0][v1][v2]concat=n=3:v=1:a=0[outv]',
                    '[t0][t1][t2]concat=n=3:v=0:a=1[outa]'])
    run('ffmpeg', '-v', 'error', *inputs, '-i', str(args.original_movie),
        '-filter_complex', ';'.join(filters), '-map', '[outv]', '-map', '[outa]',
        '-frames:v', '528', '-t', '22', '-c:v', 'libx264', '-preset', 'fast',
        '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart', str(args.output))
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error',
        '-select_streams', 'v:0', '-count_frames', '-show_entries',
        'stream=width,height,r_frame_rate,nb_read_frames,duration', '-of', 'json',
        str(args.output)], text=True))['streams'][0]
    if (info['width'], info['height'], info['r_frame_rate'], int(info['nb_read_frames'])) != (1920, 1080, '24/1', 528):
        raise ValueError('Final diagnostic frame/format mismatch')
    run('ffmpeg', '-v', 'error', '-i', str(args.output), '-f', 'null', '-')
    report = {'version': 'V025', 'kind': 'TECHNICAL_DIAGNOSTIC_REEL',
              'production_approved': False, 'full_132_second_movie': False,
              'frames': 528, 'duration_seconds': 22, 'width': 1920, 'height': 1080,
              'fps': 24, 'sha256': digest(args.output),
              'bytes': args.output.stat().st_size,
              'original_movie_audio_source_sha256': original_sha,
              'segments': evidence, 'decoded_entire_video': True}
    key = 'native/S1E1/V025/review/' + args.output.name
    s3.upload_file(str(args.output), c['S3_BUCKET'], key,
                   ExtraArgs={'ContentType': 'video/mp4', 'Metadata': {'sha256': report['sha256']}})
    body = s3.get_object(Bucket=c['S3_BUCKET'], Key=key)['Body']
    check = hashlib.sha256()
    for block in iter(lambda: body.read(4 * 1024 * 1024), b''):
        check.update(block)
    if check.hexdigest() != report['sha256']:
        raise ValueError('Stored review checksum mismatch')
    report['key'] = key
    report_path = args.output.with_suffix('.json')
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
    s3.put_object(Bucket=c['S3_BUCKET'], Key=key.removesuffix('.mp4') + '.json',
                  Body=report_path.read_bytes(), ContentType='application/json')
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
