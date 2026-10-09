"""Original scene-specific orchestral score rendered with the MIT-licensed FluidR3 samples.
The composition is authored here, not copied from a film or stock recording.
"""
import ctypes as C,json,sys,math,wave
from pathlib import Path
import numpy as np
root=Path(sys.argv[1]).resolve();out=root/'episode-v016';sr=24000
lib=C.CDLL(str(out/'music-runtime/synth/usr/lib/x86_64-linux-gnu/libfluidsynth.so.3'))
def fn(name,ret,args):
 f=getattr(lib,name);f.restype=ret;f.argtypes=args;return f
ptr=C.c_void_p;integer=C.c_int;string=C.c_char_p
settings=fn('new_fluid_settings',ptr,[])();fn('fluid_settings_setnum',integer,[ptr,string,C.c_double])(settings,b'synth.sample-rate',sr);fn('fluid_settings_setnum',integer,[ptr,string,C.c_double])(settings,b'synth.gain',.42)
fn('fluid_settings_setint',integer,[ptr,string,integer])(settings,b'synth.chorus.active',0)
synth=fn('new_fluid_synth',ptr,[ptr])(settings)
soundfont = out/'music-runtime/fluid-new/usr/share/sounds/sf2/FluidR3_GM.sf2'
if fn('fluid_synth_sfload',integer,[ptr,string,integer])(synth,str(soundfont).encode(),1) < 0:
 raise RuntimeError('The instrument samples could not be loaded; a silent score is not a result.')
on=fn('fluid_synth_noteon',integer,[ptr,integer,integer,integer]);off=fn('fluid_synth_noteoff',integer,[ptr,integer,integer]);program=fn('fluid_synth_program_change',integer,[ptr,integer,integer]);cc=fn('fluid_synth_cc',integer,[ptr,integer,integer,integer]);write=fn('fluid_synth_write_float',integer,[ptr,integer,ptr,integer,integer,ptr,integer,integer])
# Channel palette: celesta, flute, pizzicato strings, warm strings, harp, bassoon, French horn.
for ch,prog in enumerate([8,73,45,48,46,70,60]):program(synth,ch,prog);cc(synth,ch,10,[54,76,38,64,87,44,72][ch]);cc(synth,ch,7,[88,72,63,47,67,61,64][ch])
# A modest drum palette, acoustic samples on GM percussion channel.
cc(synth,9,7,46)
source=out/'S1E1_timeline_V016.json'
x=json.loads(source.read_text() if source.exists() else (root/'episode-full-review/S1E1_full_timeline_DRAFT.json').read_text());fps=x['fps'];duration=x['total_frames']/fps
scenes={}
for b in x['beats']:
 k=int(b['scene'][-3:]);scenes.setdefault(k,[b['start_frame']/fps,b['end_frame']/fps]);scenes[k][0]=min(scenes[k][0],b['start_frame']/fps);scenes[k][1]=max(scenes[k][1],b['end_frame']/fps)
events=[];cue=[]
def note(t,ch,n,d,v=55):
 if 0<=t<duration:events.extend([(round(t*sr),1,ch,n,v),(round(min(duration,t+d)*sr),0,ch,n,0)])
def phrase(start,end,mode,tempo,idx):
 step=60/tempo;length=end-start
 base=[72,76,79,81,79,76,74,76,72,67,69,71,72,76,74,72]
 if mode=='tension':base=[69,72,76,74,72,71,69,67,69,72,74,76,74,72,71,69]
 if mode=='wonder':base=[72,79,76,84,83,79,81,79,76,74,72,76,79,84,79,76]
 if mode=='comedy':base=[72,0,76,79,0,74,71,72,79,76,0,74,72,0,67,72]
 if mode=='resolve':base=[72,76,79,84,81,79,76,74,72,76,79,81,79,76,74,72]
 chords=[(48,55,60,64),(45,52,57,60),(41,48,53,57),(43,50,55,59)] if mode!='tension' else [(45,52,57,60),(41,48,53,57),(48,55,60,64),(43,50,55,59)]
 for k in range(math.ceil(length/(4*step))):
  a=start+k*4*step;chord=chords[(k+idx)%4]
  # String breathing rather than a constant drone. Harmonic changes every bar.
  for n in chord[1:]:note(a,3,n+12,min(3.8*step,end-a),36 if mode=='tension' else 43)
  note(a,5,chord[0],min(1.45*step,end-a),48)
  for j in range(4):
   t=a+j*step
   if t+.1>=end:break
   note(t,2,chord[(j+k)%len(chord)]+12,.35*step,42+(j%2)*6)
  # Different instruments answer the motif, leaving space between phrases.
  for j in range(4):
   t=a+j*step;n=base[(k*4+j+idx*2)%len(base)]
   if not n or t+.4>=end:continue
   if mode=='tension' and k%2==1:continue
   ch=0 if (k+idx)%3==0 else 1
   note(t,ch,n+(12 if mode=='wonder' and ch==0 else 0),.68*step,53 if mode!='resolve' else 62)
  if mode in ('wonder','resolve'):
   for j in range(6):note(a+j*step/3,4,chord[j%4]+24,.65*step,40)
  if mode in ('comedy','resolve') and k%2==0:note(a,9,37,.13,38)
  if mode=='resolve':
   note(a,6,chord[1]+12,min(2.7*step,end-a),45);note(a,9,36,.15,36)
 cue.append({'start_sec':start,'end_sec':end,'mood':mode,'tempo':tempo,'scene':idx})
for scene,(a,b) in sorted(scenes.items()):
 mode='curiosity';tempo=96
 if scene in (2,19):mode='resolve';tempo=128
 if scene in (4,8):mode='comedy';tempo=112
 if scene in (5,6,7):mode='wonder';tempo=88
 if scene in (9,10,11):mode='tension';tempo=82
 if scene in (12,13):mode='curiosity';tempo=90
 if scene in (14,15,16,17):mode='resolve';tempo=104
 if scene==18:mode='wonder';tempo=84
 phrase(a,b,mode,tempo,scene)
# The title uses the precise 15-second bright cadence; three drum accents match cuts.
for t in [scenes[2][0],scenes[2][0]+3.5,scenes[2][0]+6,scenes[2][0]+9]:note(t,9,49,1.1,48)
# Crescendo payoff after the mechanism works; swell follows the action, not dialogue.
for b in x['beats']:
 if b.get('direction_hu','').startswith('A teljes kert válaszol'):
  a=b['start_frame']/fps
  for k,n in enumerate([72,76,79,84]):note(a+k*.4,6,n,3.2,68)
# Sample-accurate event rendering; one shared synth retains natural release tails.
events.sort();events.append((round(duration*sr),-1,0,0,0));pos=0
wav=out/'S1E1_original_orchestral_score_V016.wav'
with wave.open(str(wav),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr)
 for sample,action,ch,n,v in events:
  left=sample-pos
  while left>0:
   count=min(left,8192);buf=np.empty((count,2),np.float32);write(synth,count,buf.ctypes.data,0,2,buf.ctypes.data,1,2);w.writeframes((np.clip(buf,-.95,.95)*32767).astype('<i2').tobytes());pos+=count;left-=count
  if action==1:on(synth,ch,n,v)
  elif action==0:off(synth,ch,n)
(out/'music_cues_V016.json').write_text(json.dumps(cue,indent=2));print('SCORE_RENDERED',duration,len(events),flush=True)
