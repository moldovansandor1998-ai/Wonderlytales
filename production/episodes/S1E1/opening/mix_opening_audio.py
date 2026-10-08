"""Original synthesized draft theme, forest bed and current recorded HU lines."""
from pathlib import Path
import json,sys,subprocess,hashlib,wave
import numpy as np
out=Path(sys.argv[1]).resolve();schedule=json.loads((out/'dialogue_schedule.json').read_text())
sr=48000;duration=schedule['duration_sec'];mix=np.zeros((duration*sr,2),np.float64)
music=np.zeros((15*sr,2),np.float64)
def note(frequency,length):
 t=np.arange(int(length*sr))/sr
 env=(1-np.exp(-t*70))*np.exp(-t*2.4)
 return env*(np.sin(2*np.pi*frequency*t)+.22*np.sin(2*np.pi*frequency*2*t)+.08*np.sin(2*np.pi*frequency*3*t))
notes=[(0,523.25),(.55,659.25),(1.1,783.99),(1.65,659.25),(2.2,587.33),(2.75,659.25),(3.3,523.25),(4.4,392),(4.95,523.25),(5.5,659.25),(6.05,783.99),(7.15,880),(7.7,783.99),(8.25,659.25),(8.8,587.33),(9.9,523.25),(10.45,659.25),(11,783.99),(12.1,659.25),(12.65,587.33),(13.2,523.25)]
for index,(start,f) in enumerate(notes):
 a=note(f,min(1.5,15-start))*.095;pos=int(start*sr);pan=.1 if index%2 else -.1
 music[pos:pos+len(a),0]+=a*(1-pan);music[pos:pos+len(a),1]+=a*(1+pan)
for start,f in [(0,130.81),(4.4,174.61),(7.15,196),(9.9,130.81)]:
 t=np.arange(int(min(4.3,15-start)*sr))/sr
 pad=.018*(np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*1.5*t))*(1-np.exp(-t*3))*np.exp(-t*.7)
 pos=int(start*sr);music[pos:pos+len(pad)]+=pad[:,None]
music[-sr:]*=np.linspace(1,0,sr)[:,None];mix[:len(music)]+=music
rng=np.random.default_rng(4815)
noise=rng.normal(0,1,(duration*sr,2));smooth=np.convolve(noise[:,0],np.ones(80)/80,mode='same')
bed=np.column_stack((smooth,np.roll(smooth,135)))*.011
bed[:15*sr]=0;mix+=bed
for start in [15.4,16.15]:
 n=int(.32*sr);rustle=rng.normal(0,1,(n,2))*.012*np.hanning(n)[:,None]
 p=int(start*sr);mix[p:p+n]+=rustle
audio_manifest=[]
for line in schedule['dialogue']:
 path=Path(line['absolute_path'])
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(sr),'pipe:1'])
 a=np.frombuffer(raw,dtype='<f4').astype(np.float64);pos=round(line['start_sec']*sr)
 mix[pos:pos+len(a)]+=a[:,None]*.9
 audio_manifest.append({'character':line['character'],'text':line['text'],'start_sec':line['start_sec'],'decoded_duration_sec':len(a)/sr,'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
peak=float(np.abs(mix).max());assert peak<1,'Avoid clipping rather than silently limiting speech.'
def save(path,data):
 with wave.open(str(path),'wb') as w:
  w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes((np.clip(data,-1,1)*32767).astype('<i2').tobytes())
save(out/'opening_mix_DRAFT.wav',mix);save(out/'intro_music_V001_DRAFT.wav',music)
(out/'audio_mix_QC.json').write_text(json.dumps({'sample_rate':sr,'channels':2,'duration_sec':duration,'peak':peak,'clipped':False,'intro_music_duration_sec':15,'music_status':'ORIGINAL_PROCEDURAL_COMPOSITION_DRAFT','dialogue':audio_manifest,'full_episode_audio_mixed':False},ensure_ascii=False,indent=2))
print('AUDIO_MIX_SAVED',peak,duration)
