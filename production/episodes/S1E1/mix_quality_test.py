"""Accepted Hungarian mix + native foot/stone contacts, normalized trial audio.
Run with a Python runtime containing NumPy. No external generation or credits.
"""
import subprocess,json,sys,wave
from pathlib import Path
import numpy as np
root=Path(sys.argv[1]);out=root/'episode-v018';rate=48000
def pcm(path):
 return np.frombuffer(subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ar',str(rate),'-ac','2','-'],capture_output=True,check=True).stdout,dtype='<f4').reshape(-1,2).copy()
base=pcm(out/'QUALITY_TEST_audio_V018.wav');mix=np.zeros((rate*60,2),dtype=np.float64);mix[:min(len(base),len(mix))]=base[:len(mix)]
leaf=[pcm(root/'episode-v016/sfx/steps'/name) for name in ['leaves01.ogg','leaves02.ogg']];stone=pcm(root/'episode-v016/sfx/steps/stone01.ogg')
gain={'CHAR_MARK':.13,'CHAR_LILI':.055,'CHAR_MORZSI':.17,'CHAR_POTTY':.04,'CHAR_ZIZI':.06,'CHAR_BOGYO':.035};events=[]
def add(data,t,volume):
 a=round(t*rate);b=min(len(mix),a+len(data));mix[a:b]+=data[:b-a]*volume
for index,cue in enumerate(json.loads((out/'quality_test_foot_contacts_V018.json').read_text())['events']):
 add(leaf[index%2],cue['time_sec'],gain[cue['character']]);events.append({'type':'FOOTSTEP',**cue})
for cue in json.loads((out/'quality_test_physics_V018.json').read_text())['impacts']:
 add(stone,cue['time_sec'],.12*min(1,cue['speed_m_s']/5.7));events.append({'type':'STONE_CONTACT',**cue})
reaction=out/'quality_test_reaction_V018.json'
if reaction.exists():
 cue=json.loads(reaction.read_text());add(pcm(root/cue['audio']),cue['start_sec'],1);events.append({'type':'REACTION',**cue})
peak=float(np.max(np.abs(mix)));mix*=min(1,.95/max(.95,peak))
with wave.open(str(out/'QUALITY_TEST_premix_V018.wav'),'wb') as stream:
 stream.setnchannels(2);stream.setsampwidth(2);stream.setframerate(rate);stream.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',str(out/'QUALITY_TEST_premix_V018.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000','-ac','2',str(out/'QUALITY_TEST_final_audio_V018.wav')],check=True)
(out/'quality_test_audio_events_V018.json').write_text(json.dumps({'base':'accepted V016 Hungarian dialogue/music/ambience/FX master, seconds 243–303','new_credit_cost':0,'contact_events':events,'target_lufs':-16,'target_true_peak_dbfs':-1.5,'voice_performances_unchanged':True},ensure_ascii=False,indent=2))
print('TRIAL_SOUND_MIXED',len(events),flush=True)
