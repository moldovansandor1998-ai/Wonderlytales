"""Insert the original 15-second opening into the verified dialogue edit.

Creates a review mix, not a claim of finished animation or final sound design.
"""
import argparse, json, subprocess, wave
from pathlib import Path
import numpy as np

p=argparse.ArgumentParser(); p.add_argument('source'); p.add_argument('output')
args=p.parse_args(); src=Path(args.source); out=Path(args.output); out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((src/'S1E1_edit_decisions.json').read_text())
fps=timeline['fps']; sr=48000
insert=max(b['end_frame'] for b in timeline['beats'] if b['scene']=='S1E1_SC001')
with wave.open(str(src/'S1E1_dialogue_edit_HU_DRAFT.wav')) as w:
    assert w.getframerate()==sr and w.getnchannels()==1 and w.getsampwidth()==2
    original=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(np.float32)/32768
offset=round(insert*sr/fps); length=15*sr
mix=np.zeros((len(original)+length,2),dtype=np.float32)
mix[:offset]=original[:offset,None]*.88
mix[offset+length:]=original[offset:,None]*.88
theme=np.zeros((length,2),np.float32)
notes=[(0,523.25),(.55,659.25),(1.1,783.99),(1.65,659.25),(2.2,587.33),(2.75,659.25),(3.3,523.25),(4.4,392),(4.95,523.25),(5.5,659.25),(6.05,783.99),(7.15,880),(7.7,783.99),(8.25,659.25),(8.8,587.33),(9.9,523.25),(10.45,659.25),(11,783.99),(12.1,659.25),(12.65,587.33),(13.2,523.25)]
for idx,(start,f) in enumerate(notes):
    t=np.arange(round(min(1.5,15-start)*sr))/sr
    a=.095*(1-np.exp(-70*t))*np.exp(-2.4*t)*(np.sin(2*np.pi*f*t)+.22*np.sin(4*np.pi*f*t))
    pos=round(start*sr); pan=.1 if idx%2 else -.1
    theme[pos:pos+len(a),0]+=a*(1-pan); theme[pos:pos+len(a),1]+=a*(1+pan)
theme[-sr:]*=np.linspace(1,0,sr)[:,None]
mix[offset:offset+length]+=theme
# SC019 already exists in the source timeline; score its existing 15 seconds.
credits=next(b for b in timeline['beats'] if b['scene']=='S1E1_SC019')
credits_sample=round((credits['start_frame']+15*fps)*sr/fps)
mix[credits_sample:credits_sample+length]+=theme*.65
for b in timeline['beats']:
    if b['start_frame']>=insert:
        for key in ('start_frame','end_frame','audio_start_frame','audio_end_frame'):
            if key in b: b[key]+=15*fps
timeline['beats'].append({'scene':'S1E1_SC002','kind':'INTRO','start_frame':insert,'end_frame':insert+15*fps,'duration_frames':15*fps,'animation_status':'NOT_RENDERED'})
timeline['beats'].sort(key=lambda b:b['start_frame']); timeline['total_frames']+=15*fps
(out/'S1E1_full_timeline_DRAFT.json').write_text(json.dumps(timeline,ensure_ascii=False,indent=2))
def parse_time(s):
    h,m,rest=s.split(':'); sec,ms=rest.split(','); return ((int(h)*60+int(m))*60+int(sec))*1000+int(ms)
def format_time(ms):
    h,r=divmod(ms,3600000); m,r=divmod(r,60000); s,ms=divmod(r,1000); return f'{h:02}:{m:02}:{s:02},{ms:03}'
lines=[]
for line in (src/'S1E1_dialogue_HU.srt').read_text().splitlines():
    if ' --> ' in line:
        a,b=line.split(' --> '); av,bv=parse_time(a),parse_time(b)
        line=f'{format_time(av+(15000 if av>=round(insert*1000/fps) else 0))} --> {format_time(bv+(15000 if bv>=round(insert*1000/fps) else 0))}'
    lines.append(line)
(out/'S1E1_full_HU.srt').write_text('\n'.join(lines)+'\n')
peak=float(np.abs(mix).max()); clipped=int((np.abs(mix)>=1).sum()); assert clipped==0
with wave.open(str(out/'S1E1_full_audio_HU_REVIEW.wav'),'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
    for start in range(0,len(mix),sr*30): w.writeframes((mix[start:start+sr*30]*32767).astype('<i2').tobytes())
for ext,codec in [('m4a',['-c:a','aac','-b:a','160k']),('flac',['-c:a','flac'])]:
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(out/'S1E1_full_audio_HU_REVIEW.wav'),*codec,str(out/f'S1E1_full_audio_HU_REVIEW.{ext}')],check=True)
qc={'duration_sec':len(mix)/sr,'total_frames':timeline['total_frames'],'intro_start_frame':insert,'intro_seconds':15,'credits_seconds':15,'dialogue_count':131,'peak':peak,'clipped_samples':clipped,'animation_complete':False,'final_sound_design_complete':False,'episode_finished':False,'status':'FULL_LENGTH_AUDIO_REVIEW_WITH_OPENING_AND_CREDITS'}
(out/'S1E1_full_audio_QC.json').write_text(json.dumps(qc,indent=2)); print(json.dumps(qc))
