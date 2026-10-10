"""Build identical 24s HU audio/shot inputs for TECH_AB_V001; never render.

Uses only already existing project R2 takes and the preserved V024 movie.
This is a benchmark INPUT package, not either of the requested A/B movies.
"""
import argparse
import hashlib
import json
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / 'production/technology_trials/TECH_AB_V001'
RATE = 48000

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write_json(path, obj):
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')

def pcm(path, start=None, duration=None):
    cmd = ['ffmpeg', '-v', 'error']
    if start is not None:
        cmd += ['-ss', str(start)]
    cmd += ['-i', str(path)]
    if duration is not None:
        cmd += ['-t', str(duration)]
    cmd += ['-f', 'f32le', '-ar', str(RATE), '-ac', '2', 'pipe:1']
    return np.frombuffer(subprocess.check_output(cmd), dtype='<f4').reshape(-1, 2).copy()

def wav(path, data):
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(2); stream.setsampwidth(2); stream.setframerate(RATE)
        stream.writeframes(np.round(data * 32767).astype('<i2').tobytes())

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--credentials', required=True, help='Existing project S3 credentials JSON; never copied to outputs')
    p.add_argument('--v024-movie', required=True)
    p.add_argument('--output', required=True)
    args = p.parse_args()
    movie = Path(args.v024_movie)
    if sha(movie) != 'a76eec569f2d81da981aac2db3ead7f7a4e30fe9dc7b195af705cd13cc95ade8':
        raise ValueError('V024 movie checksum differs; refusing unknown audio source')
    import boto3
    c = json.loads(Path(args.credentials).read_text())
    s3 = boto3.client('s3', endpoint_url=c['S3_ENDPOINT'], aws_access_key_id=c['S3_ACCESS_KEY_ID'], aws_secret_access_key=c['S3_SECRET_ACCESS_KEY'])
    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    (out / 'takes').mkdir(exist_ok=True)
    feature = json.loads((ROOT / 'production/episodes/S1E1/feature_V002/feature_scene_plan_V002.json').read_text())
    ids = [('cef6b5f3-6050-54bf-a715-e18f410dc821', 4.5),
           ('2386fc17-10d1-5170-95a2-0b36f3ff120a', 8.25),
           ('f7008600-293c-55a7-90be-29a90764b6e3', 20.25)]
    dialogue = np.zeros((RATE * 24, 2), dtype=np.float64)
    lines = []
    for identity, start in ids:
        row = next(b for scene in feature['scenes'] for b in scene['beats'] if b.get('recording_id') == identity)
        path = out / 'takes' / (identity + '.mp3')
        if not path.exists():
            s3.download_file(c['S3_BUCKET'], row['audio_storage_key'], str(path))
        if sha(path) != row['audio_sha256']:
            raise ValueError('Original HU take checksum differs: ' + identity)
        samples = pcm(path); a = round(start * RATE); b = a + len(samples)
        if b > len(dialogue): raise ValueError('Dialogue exceeds benchmark duration')
        dialogue[a:b] += samples * .78
        lines.append(dict(id=identity, character=row['character'], text_hu=row['text_hu'], start_sec=start,
            end_sec=b / RATE, source_key=row['audio_storage_key'], sha256=sha(path),
            relative_file='takes/' + path.name, source_recording_status=row['recording_status']))
    # Reuse an existing non-dialogue forest/music bed from SC003 0–4s.
    # A short linear crossfade avoids hard loop boundaries. This remains
    # scratch sound design, not a new professionally scored/sounded final mix.
    bed = pcm(movie, 58, 4).astype(np.float64)
    fade = RATE // 4; window = np.ones(len(bed)); window[:fade] = np.linspace(0, 1, fade)
    window[-fade:] = np.linspace(1, 0, fade)
    ambience = np.zeros_like(dialogue)
    for a in range(0, len(ambience), len(bed) - fade):
        n = min(len(bed), len(ambience) - a)
        ambience[a:a+n] += bed[:n] * window[:n, None]
    # Exact legacy walk foley/music from the dialogue-free first 4 seconds.
    ambience[:4*RATE] = pcm(movie, 0, 4)
    ambience[-fade:] *= np.linspace(1, 0, fade)[:, None]
    master = dialogue + ambience
    peak = float(np.abs(master).max())
    if peak >= .98: raise ValueError('Mix requires gain adjustment; refuse clipping')
    wav(out / 'TECH_AB_V001_dialogue_HU.wav', dialogue)
    wav(out / 'TECH_AB_V001_music_sfx_scratch.wav', ambience)
    wav(out / 'TECH_AB_V001_common_HU_24s.wav', master)
    shots = [
        dict(id='SH01', start_sec=0, end_sec=8, lens_mm=40, view='full_body_then_medium',
             action_hu='Márk és Lili a mohos kőhöz közelít. Mindkettő járása látható. Súlyáthelyezés, lassítás, megállás. Márk a szilánkra, majd Lilire néz; első mondat.',
             camera_hu='Oldalirányú követés, majd lassú befordulás; a lábak 0–4 s között nem takarhatók el.'),
        dict(id='SH02', start_sec=8, end_sec=12, lens_mm=65, view='lili_three_quarter_face',
             action_hu='Lili száraz humorral válaszol, szemöldök/fül/tekintet reakció; Márk képszélen figyeli.',
             camera_hu='Finom közelítés, szemmagasság, éles szemek és száj.'),
        dict(id='SH03', start_sec=12, end_sec=20, lens_mm=50, view='uncut_side_pickup',
             action_hu='Márk letérdel vagy guggol, kendőn át megfogja a szilánkot. Ujjzárás és hüvelykujj-támasz után elemelés, felállás. Lili követi a kezet. A kő, kéz és tárgy érintkezése látható.',
             camera_hu='Egyetlen vágatlan oldal-háromnegyed beállítás; a tárgyfelvételt tilos vágással eltakarni.'),
        dict(id='SH04', start_sec=20, end_sec=24, lens_mm=55, view='mark_face_and_shared_reaction',
             action_hu='Márk felmutatja a kendőben tartott szilánkot és elmondja a harmadik mondatot; Lili a fényre, majd Márkra néz. Apró öröm, közös kíváncsiság.',
             camera_hu='Rövid ív kétalakos közeli felé, a tartó kéz a képben marad.')]
    media = []
    for path in sorted(out.glob('*.wav')):
        media.append(dict(filename=path.name, sha256=sha(path), bytes=path.stat().st_size))
    contract = dict(schema='WONDERLY_TECH_AB_V1', id='TECH_AB_V001', source_scene='S1E1_SC003',
        kind='BENCHMARK_INPUTS_ONLY', duration_seconds=24, fps=24, frames=576, width=1920, height=1080,
        characters=['CHAR_MARK', 'CHAR_LILI'], source_movie_sha256=sha(movie), dialogue=lines, shots=shots,
        audio_assets=media, audio_peak=peak, source_audio_reused=True, new_tts_calls=0,
        professional_audio_approved=False, production_approved=False, actual_a_video=None, actual_b_video=None,
        test_views=['full body in motion', 'three-quarter face closeup', 'uncut side grasp', 'shared reaction'])
    SPEC.mkdir(parents=True, exist_ok=True)
    write_json(SPEC / 'scene.json', contract)
    write_json(out / 'scene.json', contract)
    for shot in shots:
        a = round(shot['start_sec'] * RATE); b = round(shot['end_sec'] * RATE)
        wav(out / (shot['id'] + '_dialogue_HU.wav'), dialogue[a:b])
    print(json.dumps(dict(status='INPUTS_READY_NOT_VIDEOS', duration=24, original_takes=3, peak=peak, output=str(out))))

if __name__ == '__main__': main()
