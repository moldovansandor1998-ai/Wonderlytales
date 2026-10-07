"""Prepend one fixed, checksum-pinned 15-second master to an episode.

Only the integer episode number is overlaid on frames 288–359. This script
does not create the intro or infer that draft character work is approved.
"""
import argparse
import hashlib
import json
import subprocess
from fractions import Fraction
from pathlib import Path

def probe(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames',
        '-show_streams', '-show_format', '-of', 'json', str(path)]))

def streams(data):
    try:
        return (next(s for s in data['streams'] if s['codec_type'] == 'video'),
                next(s for s in data['streams'] if s['codec_type'] == 'audio'))
    except StopIteration:
        raise ValueError('Both inputs require video and an audio track.')

def validate(data, intro=False):
    v, a = streams(data)
    if (v['width'], v['height']) != (1920, 1080) or Fraction(v['avg_frame_rate']) != 24 or Fraction(v['r_frame_rate']) != 24:
        raise ValueError('Both inputs must be native 1920×1080 / 24 fps masters; no automatic upscaling or retiming.')
    if Fraction(v.get('sample_aspect_ratio', '1:1').replace(':', '/')) != 1:
        raise ValueError('Square pixels required.')
    if intro and (int(v['nb_read_frames']) != 360 or abs(float(v['duration'])-15) > .001):
        raise ValueError('The fixed intro must contain exactly 360 frames / 15 seconds.')
    if abs(float(a['duration']) - float(v['duration'])) > .1:
        raise ValueError('Audio must cover the video duration.')
    return int(v['nb_read_frames'])

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--intro', type=Path, required=True)
    p.add_argument('--intro-sha256', required=True, help='Pinned checksum of the selected reusable master.')
    p.add_argument('--episode', type=Path, required=True)
    p.add_argument('--number', type=int, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--font', type=Path, required=True, help='Local font with Hungarian characters.')
    a=p.parse_args()
    if a.number < 1: raise ValueError('Episode number must be positive.')
    for f in [a.intro,a.episode,a.font]:
        if not f.is_file(): raise ValueError(f'Missing input: {f}')
    if a.output.exists(): raise ValueError('Output already exists; choose a new path.')
    if hashlib.sha256(a.intro.read_bytes()).hexdigest() != a.intro_sha256:
        raise ValueError('Intro master checksum mismatch; do not silently replace the series opening.')
    intro_frames=validate(probe(a.intro),intro=True)
    episode_frames=validate(probe(a.episode))
    # A private local font copy avoids filter-expression injection from paths.
    import tempfile, shutil
    with tempfile.TemporaryDirectory(prefix='wonderly-intro-') as tmp:
        font=Path(tmp)/'title-font.ttf'; shutil.copyfile(a.font,font)
        filt=(f"[0:v]setpts=PTS-STARTPTS,drawtext=fontfile={font}:text='{a.number}. rész':"
              "x=(w-tw)/2:y=h*0.84:fontsize=48:fontcolor=white:shadowcolor=black:shadowx=2:shadowy=2:"
              "enable='gte(n,288)*lt(n,360)'[iv];"
              "[1:v]setpts=PTS-STARTPTS[ev];"
              "[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=15,asetpts=PTS-STARTPTS[ia];"
              "[1:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[ea];"
              "[iv][ia][ev][ea]concat=n=2:v=1:a=1[v][a]")
        a.output.parent.mkdir(parents=True,exist_ok=True)
        partial=a.output.with_name(a.output.stem+'.partial.mp4')
        if partial.exists(): raise ValueError('Partial output exists; choose a new output path.')
        try:
            subprocess.run(['ffmpeg','-v','error','-n','-i',str(a.intro),'-i',str(a.episode),
                '-filter_complex',filt,'-map','[v]','-map','[a]','-c:v','libx264','-crf','17',
                '-preset','medium','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
                '-movflags','+faststart',str(partial)],check=True)
            rendered=validate(probe(partial))
            if rendered != intro_frames+episode_frames: raise ValueError('Output frame count mismatch.')
            subprocess.run(['ffmpeg','-v','error','-i',str(partial),'-f','null','-'],check=True)
            partial.rename(a.output)
        finally:
            if partial.exists():partial.unlink()
    receipt={'intro_sha256':a.intro_sha256,'episode_number':a.number,'intro_frames':360,
             'content_start_sec':15,'content_start_frame':360,'output_frames':rendered,
             'output_sha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),
             'production_approval':'NOT_INFERRED_FROM_ASSEMBLY'}
    a.output.with_suffix('.assembly.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps(receipt))

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,StopIteration) as e: raise SystemExit(f'Assembly rejected: {e}')
