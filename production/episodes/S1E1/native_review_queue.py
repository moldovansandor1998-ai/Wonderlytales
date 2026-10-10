"""Resume the native V017 review; preserve source hashes and accepted V016 sound.

This queue produces a review, never a production-approved film.
Usage: python native_review_queue.py BLENDER ASSET_ROOT OUTPUT_DIRECTORY
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def atomic_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    tmp.replace(path)


def render_child(plan_path):
    import bpy
    plan = json.loads(plan_path.read_text())
    out = Path(plan['output'])
    for segment in plan['segments']:
        source = Path(segment['source'])
        if digest(source) != segment['sha256']:
            raise RuntimeError('Source changed; refusing mixed render caches')
        folder = out / segment['name']
        folder.mkdir(exist_ok=True)
        spec = {'sha256': segment['sha256'], 'engine': 'CYCLES', 'samples': 4,
                'resolution': [960, 540], 'delivery_fps': 24, 'native_fps': 12,
                'start': segment['start'], 'end': segment['end']}
        stamp = folder / 'source.json'
        if stamp.exists() and json.loads(stamp.read_text()) != spec:
            raise RuntimeError('Render settings changed; use a fresh output folder')
        atomic_json(stamp, spec)
        bpy.ops.wm.open_mainfile(filepath=str(source))
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 4
        scene.cycles.use_denoising = True
        scene.render.resolution_x = 960
        scene.render.resolution_y = 540
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.use_sequencer = False
        scene.render.use_persistent_data = True
        expected = (segment['end'] - segment['start'] + 1) // 2
        for index, frame in enumerate(range(segment['start'], segment['end'] + 1, 2)):
            target = folder / f'{index:05}.png'
            if target.exists():
                if target.stat().st_size < 10000:
                    raise RuntimeError('Incomplete cached image: ' + str(target))
                continue
            scene.frame_set(frame)
            scene.render.filepath = str(folder / f'{index:05}.pending.png')
            bpy.ops.render.render(write_still=True)
            Path(scene.render.filepath).replace(target)
            atomic_json(out / 'state.json', {'status': 'NATIVE_REVIEW_RENDERING',
                        'segment': segment['name'], 'native_frames_done': index + 1,
                        'native_frames_expected': expected, 'source_frame': frame,
                        'source_sha256': segment['sha256'], 'full_episode_finished': False,
                        'production_approved': False})
            print('REVIEW_FRAME', segment['name'], index + 1, expected, flush=True)
        print('SEGMENT_RENDER_COMPLETE', segment['name'], flush=True)


def main():
    blender, asset_root, output = sys.argv[1:]
    root, out = Path(asset_root).resolve(), Path(output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    scenes = [('SC001', 'S1E1_SC001_NATIVE_ACTING_V017.blend', 1, 1600),
              ('SC003', 'S1E1_SC003_FRAGMENT_PICKUP_BLOCKING_V017.blend', 1961, 3602),
              ('STORY', 'S1E1_SC004_019_STORY_BLOCKING_V017.blend', 3603, 30294)]
    plan = {'output': str(out), 'segments': [
        {'name': name, 'source': str(root / 'episode-v017' / filename),
         'sha256': digest(root / 'episode-v017' / filename), 'start': start, 'end': end}
        for name, filename, start, end in scenes]}
    plan_path = out / 'plan.json'
    if plan_path.exists() and json.loads(plan_path.read_text()) != plan:
        raise RuntimeError('Existing queue has different source files')
    atomic_json(plan_path, plan)
    atomic_json(out / 'state.json', {'status': 'NATIVE_REVIEW_STARTING',
                                   'production_approved': False, 'full_episode_finished': False})
    subprocess.run([blender, '-b', '--python-exit-code', '1', '--python', str(Path(__file__).resolve()),
                    '--', 'render', str(plan_path)], check=True)
    videos = []
    for segment in plan['segments']:
        video = out / (segment['name'] + '.mp4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '12', '-i',
            str(out / segment['name'] / '%05d.png'), '-vf', 'fps=24', '-an',
            '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
            '-movflags', '+faststart', str(video)], check=True)
        videos.append(video)
    intro = root / 'WonderlyTales_S1E1_mozgo_3D_focim_V016.mp4'
    picture = out / 'picture.mp4'
    # All sources are 960x540/24 fps; explicitly normalize intro stream time base.
    inputs = [videos[0], intro, videos[1], videos[2]]
    command = ['ffmpeg', '-v', 'error', '-y']
    for path in inputs:
        command += ['-i', str(path)]
    filters = ''.join(f'[{i}:v]fps=24,scale=960:540,setsar=1,setpts=PTS-STARTPTS[v{i}];'
                      for i in range(4))
    filters += '[v0][v1][v2][v3]concat=n=4:v=1:a=0[v]'
    subprocess.run(command + ['-filter_complex', filters, '-map', '[v]', '-an',
        '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
        str(picture)], check=True)
    result = out / 'WonderlyTales_S1E1_teljes_nativ_ELLENORZES.mp4'
    audio = root / 'WonderlyTales_S1E1_teljes_hangvagas_V016.m4a'
    subtitle = root / 'episode-v016' / 'S1E1_HU_V016.srt'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(picture), '-i', str(audio),
        '-i', str(subtitle), '-map', '0:v:0', '-map', '1:a:0', '-map', '2:0',
        '-c:v', 'copy', '-c:a', 'copy', '-c:s', 'mov_text', '-metadata:s:s:0',
        'language=hun', '-movflags', '+faststart', str(result)], check=True)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams',
                                               '-show_format', '-of', 'json', str(result)]))
    video = next(s for s in probe['streams'] if s['codec_type'] == 'video')
    if int(video['nb_frames']) != 30294 or abs(float(video['duration']) - 1262.25) > .05:
        raise RuntimeError('Full review frame count or duration mismatch')
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(result), '-f', 'null', '-'], check=True)
    atomic_json(out / 'state.json', {'status': 'NATIVE_TECHNICAL_REVIEW_COMPLETE',
                 'review_file': str(result), 'frames': 30294, 'duration_seconds': 1262.25,
                 'production_approved': False, 'full_episode_finished': False,
                 'requires_directorial_review': True})


if __name__ == '__main__':
    try:
        if '--' in sys.argv:
            args = sys.argv[sys.argv.index('--') + 1:]
            if args[0] != 'render':
                raise ValueError('Unknown Blender queue action')
            render_child(Path(args[1]))
        else:
            main()
    except Exception as error:
        if '--' not in sys.argv and len(sys.argv) == 4:
            folder = Path(sys.argv[3])
            if folder.is_dir():
                atomic_json(folder / 'state.json', {'status': 'NATIVE_REVIEW_FAILED',
                            'error': str(error), 'production_approved': False,
                            'full_episode_finished': False})
        print('NATIVE_QUEUE_FAILED', str(error), file=sys.stderr, flush=True)
        raise
