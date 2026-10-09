"""Build a reproducible full dialogue edit from the existing measured beat timeline.

This is a dialogue stem with silent action intervals, not a finished soundtrack
or moving animatic. Source recordings are checked by hash before use.
Usage: python build_dialogue_edit.py AUDIO_DIRECTORY OUTPUT_DIRECTORY
"""
from pathlib import Path
import argparse, hashlib, json, subprocess, wave
import numpy as np

def timestamp(seconds):
    ms=round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def build(audio, output):
    timeline_path=Path(__file__).parent/'timing/current_recordings_V002/beat_timeline_current_recordings_DRAFT.json'
    timeline=json.loads(timeline_path.read_text())
    manifest=json.loads((audio/'manifest.json').read_text())
    sources={x['id']:x for x in manifest['dialogue']}
    output.mkdir(parents=True, exist_ok=True)
    rate=48000; fps=timeline['fps']
    length=round(timeline['total_frames']/fps*rate)
    mix=np.zeros(length, np.float32)
    records=[]; subtitles=[]; edit=[]; previous_end=0; previous_scene_end=0
    for scene in timeline['scenes']:
        assert scene['start_frame']==previous_scene_end, 'Scene continuity gap'
        previous_scene_end=scene['end_frame']
        for beat in scene['beats']:
            edit.append({'scene':scene['scene_code'],**beat})
            if beat['kind']!='DIALOGUE': continue
            source=sources[beat['recording_id']]
            assert source['text']==beat['text_hu'] and source['character']==beat['character']
            path=audio/source['file']
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            assert digest==beat['audio_sha256'], f'Source changed: {path}'
            raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(rate),'pipe:1'])
            pcm=np.frombuffer(raw,dtype='<f4')
            assert np.isfinite(pcm).all()
            start=round(beat['audio_start_frame']/fps*rate); end=start+len(pcm)
            assert start>=previous_end and end<=length, 'Dialogue overlap or out of range'
            assert abs(len(pcm)/rate-beat['measured_audio_duration_sec'])<0.1
            mix[start:end]=pcm
            previous_end=end
            records.append({'beat_id':beat['beat_id'],'recording_id':source['id'],'file':source['file'],
                'sha256':digest,'character':source['character'],'text_hu':source['text'],
                'start_sample':start,'end_sample':end,'duration_sec':len(pcm)/rate})
            subtitles.append(f"{len(records)}\n{timestamp(start/rate)} --> {timestamp(end/rate)}\n{source['text']}\n")
    assert len(records)==timeline['recorded_dialogue_count']==131
    assert previous_scene_end==timeline['total_frames']
    peak=float(np.abs(mix).max()); assert peak<1, 'Source clips; review before delivery'
    wav=output/'S1E1_dialogue_edit_HU_DRAFT.wav'
    with wave.open(str(wav),'wb') as stream:
        stream.setnchannels(1);stream.setsampwidth(2);stream.setframerate(rate)
        stream.writeframes(np.round(mix*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','flac',str(output/'S1E1_dialogue_edit_HU_DRAFT.flac')],check=True)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','aac','-b:a','128k',str(output/'S1E1_dialogue_edit_HU_DRAFT.m4a')],check=True)
    (output/'S1E1_dialogue_HU.srt').write_text('\n'.join(subtitles),encoding='utf-8')
    (output/'S1E1_edit_decisions.json').write_text(json.dumps({'fps':fps,'total_frames':timeline['total_frames'],'beats':edit},ensure_ascii=False,indent=2))
    report={'status':'FULL_DIALOGUE_EDIT_DRAFT','sample_rate':rate,'channels':1,'duration_sec':length/rate,
       'total_frames':timeline['total_frames'],'scenes':len(timeline['scenes']),'dialogue_count':len(records),
       'source_hashes_verified':True,'peak':peak,'clipped_samples':int((np.abs(mix)>=1).sum()),
       'decoded_speech_sec':sum(r['duration_sec'] for r in records),'action_intervals':'SILENT_UNSCORED',
       'music_complete':False,'sound_design_complete':False,'animation_complete':False,'episode_finished':False,
       'unused_recording_ids':sorted(set(sources)-{r['recording_id'] for r in records}),
       'timeline_sha256':hashlib.sha256(timeline_path.read_bytes()).hexdigest(),'recordings':records}
    (output/'S1E1_audio_edit_QC.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='recordings'},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('audio',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();build(args.audio.resolve(),args.output.resolve())
