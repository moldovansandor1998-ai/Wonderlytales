"""Assemble real, complete A/B trial footage with the SAME frozen HU audio.

Rejects old 22s diagnostics, stills, truncated media and silent mock paths.
Does not generate, retime, loop, pad or certify animation quality.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / 'production/technology_trials/TECH_AB_V001/scene.json'

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames',
        '-show_streams', '-show_format', '-of', 'json', str(path)]))

def validate_video(path, contract):
    data = probe(path)
    streams = [s for s in data['streams'] if s['codec_type'] == 'video' and not s.get('disposition', {}).get('attached_pic')]
    if len(streams) != 1: raise ValueError('Exactly one real video stream is required')
    s = streams[0]
    seconds = float(s.get('duration') or data['format']['duration'])
    if abs(seconds - contract['duration_seconds']) > 1/24:
        raise ValueError(f'Expected complete 24s story trial; got {seconds}s. No padding/retiming allowed.')
    if s['width'] != 1920 or s['height'] != 1080:
        raise ValueError('1920x1080 delivery required; native/upscaled provenance must be checked separately')
    num, den = map(int, s['avg_frame_rate'].split('/')); fps = num/den
    if fps < 23.9 or int(s['nb_read_frames']) < 575:
        raise ValueError('Not a complete moving-video stream')
    subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(path), '-f', 'null', '-'], check=True)
    return dict(sha256=sha(path), bytes=path.stat().st_size, duration_seconds=seconds,
        native_fps=fps, decoded_frames=int(s['nb_read_frames']), width=s['width'], height=s['height'])

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--a', required=True, type=Path)
    p.add_argument('--b', required=True, type=Path)
    p.add_argument('--audio', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args(); contract = json.loads(CONTRACT.read_text())
    expected = next(m['sha256'] for m in contract['audio_assets'] if m['filename'] == 'TECH_AB_V001_common_HU_24s.wav')
    if sha(args.audio) != expected: raise ValueError('Benchmark HU audio differs from frozen contract')
    # Validate both inputs BEFORE writing any deliverable.
    inputs = {name: validate_video(path, contract) for name, path in [('A', args.a), ('B', args.b)]}
    if inputs['A']['sha256'] == inputs['B']['sha256']:
        raise ValueError('The two technology outputs must not be the same video')
    args.output.mkdir(parents=True, exist_ok=True)
    report = dict(experiment='TECH_AB_V001', common_audio_sha256=expected, inputs=inputs,
        outputs={}, comparison_status='AWAITING_VISUAL_AND_AUDIO_REVIEW',
        native_resolution_provenance_verified=False, production_approved=False)
    for name, path in [('A', args.a), ('B', args.b)]:
        dest = args.output / f'TECH_AB_V001_{name}_24s_1080p.mp4'
        if dest.exists(): raise FileExistsError(f'Preserve existing output: {dest}')
        subprocess.run(['ffmpeg', '-v', 'error', '-n', '-i', str(path), '-i', str(args.audio),
            '-map', '0:v:0', '-map', '1:a:0', '-vf', 'fps=24', '-c:v', 'libx264', '-crf', '17',
            '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k',
            '-movflags', '+faststart', str(dest)], check=True)
        report['outputs'][name] = validate_video(dest, contract)
        # Ninety-six timestamped samples per clip plus uncut playback are required.
        frames = args.output / (name + '_review_frames'); frames.mkdir(exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-n', '-i', str(dest), '-vf', 'fps=4',
            str(frames / '%04d.png')], check=True)
    (args.output / 'media-verification.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__': main()
