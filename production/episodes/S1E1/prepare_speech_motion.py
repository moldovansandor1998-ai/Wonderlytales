"""Generate amplitude and word-timed artist mouth controls from selected recordings.
No inferred phoneme alignment is claimed. Runs with the primary Python runtime.
"""
import json,sys,subprocess,hashlib
from pathlib import Path
import numpy as np
root=Path(sys.argv[1]).resolve();src=root/'episode-v016';out=root/'episode-v017';out.mkdir(exist_ok=True)
timeline=json.loads((src/'S1E1_timeline_V016.json').read_text());manifest=json.loads((src/'performances/manifest.json').read_text())['items'];selected={x['id']:x for x in manifest};reviews={x['performance_id']:x for x in json.loads((src/'performance_full_QC_V016.json').read_text())['reviews']}
records=[]
for beat in timeline['beats']:
 if beat['kind']!='DIALOGUE':continue
 ident=beat['recording_id'];audio=src/'performances'/f'{ident}.mp3';raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(audio),'-f','f32le','-ar','12000','-ac','1','pipe:1']);pcm=np.frombuffer(raw,dtype='<f4');frame=beat['audio_start_frame']
 rms=np.array([np.sqrt(np.mean(pcm[k:k+1000]**2)) for k in range(0,len(pcm),1000)]);peak=max(.001,float(np.quantile(rms,.92)));env=np.clip((rms/peak-.06)/.94,0,1)**.65;keys=[[frame+2*k,round(float(v),4)] for k,v in enumerate(env)]
 words=[w for w in reviews.get(ident,{}).get('words',[]) if w.get('type')=='word'];rounded=[]
 for w in words:
  text=w['text'].lower();a=frame+round(w['start']*24);b=frame+round(w['end']*24);v=.55 if any(c in text for c in 'oóöőuúüű') else .12
  rounded.extend([[a,0],[a+2,v],[max(a+2,b-2),v],[b,0]])
 records.append({'beat_id':beat['beat_id'],'scene':beat['scene'],'character':beat['character'],'audio_sha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'start_frame':frame,'end_frame':beat['audio_end_frame'],'open_keys':[[frame-1,0],*keys,[beat['audio_end_frame']+1,0]],'round_keys':rounded,'method':'MEASURED_AUDIO_ENVELOPE_WITH_WORD_TIMED_ARTIST_ROUNDING','phoneme_alignment_verified':False})
reaction_items=[x for x in manifest if x['kind']=='REACTION'];cues=[x for x in json.loads((src/'sound_cues_V016.json').read_text()) if x['type']=='REACTION']
assert len(reaction_items)==len(cues)==12
for item,cue in zip(reaction_items,cues):
 assert item['character']==cue['character']
 ident=item['id'];audio=src/'performances'/f'{ident}.mp3';raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(audio),'-f','f32le','-ar','12000','-ac','1','pipe:1']);pcm=np.frombuffer(raw,dtype='<f4');frame=round(cue['start_sec']*24);end=round(cue['end_sec']*24)
 rms=np.array([np.sqrt(np.mean(pcm[k:k+1000]**2)) for k in range(0,len(pcm),1000)]);peak=max(.001,float(np.quantile(rms,.92)));env=np.clip((rms/peak-.06)/.94,0,1)**.65;keys=[[frame+2*k,round(float(v),4)] for k,v in enumerate(env)]
 scene=next(b['scene'] for b in timeline['beats'] if b['start_frame']<=frame<b['end_frame'])
 records.append({'beat_id':ident,'scene':scene,'kind':'REACTION','character':item['character'],'audio_sha256':hashlib.sha256(audio.read_bytes()).hexdigest(),'start_frame':frame,'end_frame':end,'open_keys':[[frame-1,0],*keys,[end+1,0]],'round_keys':[[frame-1,0],[frame+2,.65],[end-2,.65],[end+1,0]],'method':'MEASURED_REACTION_AUDIO_ENVELOPE','phoneme_alignment_verified':False})
(out/'speech_motion_V017.json').write_text(json.dumps({'fps':24,'dialogue_slots':131,'reaction_slots':12,'records':records,'phoneme_alignment_verified':False},ensure_ascii=False))
print('SPEECH_MOTION',len(records),sum(len(x['open_keys']) for x in records),flush=True)
