"""Checked media assembly and deterministic review sound mix."""
import json,subprocess,wave,math,os
from pathlib import Path
import numpy as np
from .spec import atomic_json,digest

def verify_video(path,frames,fps=24):
 doc=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,r_frame_rate,width,height','-of','json',str(path)]));stream=doc['streams'][0];actual=int(stream['nb_read_frames']);rate=stream['r_frame_rate'].split('/');actualfps=int(rate[0])/int(rate[1])
 if actual!=frames or actualfps!=fps:raise ValueError('Decoded frame count or frame rate mismatch')
 subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 return {'decoded':True,'frames':actual,'fps':actualfps,'width':stream['width'],'height':stream['height'],'sha256':digest(path)}

def mix_scene(script_path,compiled_path,output):
 script_path=Path(script_path);scene=json.loads(script_path.read_text());compiled=json.loads(Path(compiled_path).read_text());sr=48000;n=round(scene['duration']*sr);music=np.zeros((n,2));speech=np.zeros_like(music);sfx=np.zeros_like(music);rng=np.random.default_rng(21021)
 # Quiet original procedural cue for a technical review, not an approved score.
 chords=[(220,261.63,329.63),(174.61,220,261.63),(196,246.94,293.66),(164.81,196,246.94)]
 for beat in range(math.ceil(scene['duration']/2)):
  start=beat*2;length=min(n-round(start*sr),sr*3)
  if length<=0:break
  t=np.arange(length)/sr;freq=chords[(beat//2)%4][beat%3];sound=(np.sin(2*np.pi*freq*t)+.25*np.sin(2*np.pi*freq*2*t))*np.exp(-t*2.2)*np.minimum(1,t/.02)*.025;idx=round(start*sr);music[idx:idx+length]+=sound[:,None]*np.array([.95,1.])
 voices=[]
 for line in scene.get('dialogue',[])+scene.get('offscreen_dialogue',[]):
  file=script_path.parent/line['audio'];raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(file),'-f','f32le','-ar',str(sr),'-ac','1','-']);voice=np.frombuffer(raw,dtype='<f4');a=round(line['start']*sr);b=min(n,a+len(voice));speech[a:b]+=voice[:b-a,None]*.78;duck_start=max(0,a-sr//6);duck_end=min(n,b+sr//5);music[duck_start:duck_end]*=.35;voices.append({'id':line['id'],'audio_sha256':digest(file),'start':line['start'],'decoded_seconds':len(voice)/sr})
 steps=0
 for event in compiled['contact_events']:
  if event['time']<=.1:continue
  # Skip stationary changes: contact has to be in a locomotion interval.
  actor=next(a for a in scene['characters'] if a['code']==event['character'])
  if not any(a['clip'] in ('walk','run','turn') and a['start']<=event['time']<a['end'] for a in actor['actions']):continue
  a=round(event['time']*sr);length=min(n-a,round(.11*sr));t=np.arange(length)/sr;noise=rng.normal(0,1,length);noise=np.convolve(noise,np.ones(7)/7,'same');sound=(noise*.045+np.sin(t*2*np.pi*95)*.028)*np.exp(-t*45);pan=max(-.6,min(.6,event['position'][0]/3));sfx[a:a+length]+=sound[:,None]*np.array([1-pan,1+pan]);steps+=1
 mix=speech+music+sfx;peak=float(np.max(np.abs(mix)));gain=min(1,.92/max(1e-9,peak));mix*=gain
 with wave.open(str(output),'wb') as out:out.setnchannels(2);out.setsampwidth(2);out.setframerate(sr);out.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
 with open(output,'rb') as file:os.fsync(file.fileno())
 report={'frames':n,'sample_rate':sr,'duration':n/sr,'peak_before_gain':peak,'peak_after_gain':float(np.max(np.abs(mix))),'gain':gain,'voices':voices,'footstep_events':steps,'music':'Original procedural development cue','sfx':'Procedural footsteps triggered by actual planned foot contacts','professional_audio_approved':False};atomic_json(Path(output).with_suffix('.mix.json'),report);return report

def mux(video,audio,output,frames):
 verify_video(video,frames);subprocess.run(['ffmpeg','-v','error','-y','-i',str(video),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(frames/24),'-movflags','+faststart',str(output)],check=True);return verify_video(output,frames)

def assemble(queue,jobs,output,audio=None):
 clips=queue.outputs(jobs);listing=Path(output).with_suffix('.concat.txt')
 if any("'" in str(p) or '\n' in str(p) for p in clips):raise ValueError('Unsafe concat filename')
 listing.write_text('\n'.join("file '"+str(p)+"'" for p in clips)+'\n');temporary=Path(output).with_name(Path(output).stem+'.silent.mp4');subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(temporary)],check=True);frames=sum(j['frames'] for j in jobs);verify_video(temporary,frames)
 if audio:return mux(temporary,audio,output,frames)
 os.replace(temporary,output);return verify_video(output,frames)
