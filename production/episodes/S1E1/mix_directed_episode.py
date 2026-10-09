"""Sample-accurate expressive dialogue/reaction edit and action-specific stereo sound design.
Retimes the animation decision list against actual generated recordings; no still-video padding.
"""
import argparse,json,math,hashlib,subprocess,wave,copy
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt,resample_poly
p=argparse.ArgumentParser();p.add_argument('root');p.add_argument('--prepare-only',action='store_true');args=p.parse_args();root=Path(args.root).resolve();out=root/'episode-v016';recordings=out/'performances';sr=48000;fps=24
original=json.loads((root/'episode-full-review/S1E1_full_timeline_DRAFT.json').read_text());x=copy.deepcopy(original);manifest=json.loads((recordings/'manifest.json').read_text());items={i['id']:i for i in manifest['items']};clips={};measure=[]
def decode(path):
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(sr),'-']);a=np.frombuffer(data,'<f4').copy()
 if not len(a) or not np.isfinite(a).all() or np.max(np.abs(a))<.005:raise RuntimeError('Empty recording: '+str(path))
 return a
for item in manifest['items']:
 file=recordings/(item['id']+'.mp3');a=decode(file);clips[item['id']]=a
 measure.append({'id':item['id'],'kind':item['kind'],'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'duration_sec':len(a)/sr,'peak':float(abs(a).max())})
# Preserve every action and original pause; extend only dialogue slots that need room.
shift=0;mapping=[]
for b,old in zip(x['beats'],original['beats']):
 a0,z0=old['start_frame'],old['end_frame'];a=a0+shift;duration=z0-a0
 if b['kind']=='DIALOGUE':
  length=math.ceil(len(clips[b['recording_id']])*fps/sr);duration=max(duration,6+length+10)
  b['audio_start_frame']=a+6;b['audio_end_frame']=a+6+length;b['measured_audio_duration_sec']=len(clips[b['recording_id']])/sr
  b['audio_storage_key']=items[b['recording_id']]['path'];b['audio_sha256']=next(m['sha256'] for m in measure if m['id']==b['recording_id']);b['performance_revision']='V016';b['text_hu']=items[b['recording_id']]['text']
 b['start_frame']=a;b['end_frame']=a+duration;b['duration_frames']=duration;mapping.append((a0,z0,a,a+duration));shift+=duration-(z0-a0)
x['total_frames']=original['total_frames']+shift
# Reacting voices sit in the actual corresponding action beat; added words receive subtitles.
def map_time(t):
 f=t*fps
 for a,z,na,nz in mapping:
  if a<=f<z:return (na+(f-a)*(nz-na)/(z-a))/fps
 return t+shift/fps
reactions=[]
for item in manifest['items']:
 if item['kind']=='REACTION':reactions.append({**item,'start_sec':map_time(item['source_start_sec']),'duration_sec':len(clips[item['id']])/sr})
x['reactions']=reactions;x['status']='PERFORMANCE_TIMED_SOUND_EDIT_REVIEW';x['animation_complete']=False
(out/'S1E1_timeline_V016.json').write_text(json.dumps(x,ensure_ascii=False,indent=2));(out/'performance_measurements_V016.json').write_text(json.dumps(measure,indent=2));
subtitle=[]
for b in x['beats']:
 if b['kind']=='DIALOGUE':subtitle.append((b['audio_start_frame']/fps,b['audio_start_frame']/fps+b['measured_audio_duration_sec'],b['text_hu']))
for r in reactions:subtitle.append((r['start_sec'],r['start_sec']+r['duration_sec'],r['text']))
subtitle.sort()
def stamp(sec):
 v=round(sec*1000);h,v=divmod(v,3600000);m,v=divmod(v,60000);s,ms=divmod(v,1000);return f'{h:02}:{m:02}:{s:02},{ms:03}'
(out/'S1E1_HU_V016.srt').write_text('\n\n'.join(f'{i+1}\n{stamp(a)} --> {stamp(z)}\n{text}' for i,(a,z,text) in enumerate(subtitle))+'\n')
if args.prepare_only:print('TIMELINE_PREPARED',x['total_frames']/fps,shift/fps);raise SystemExit
length=round(x['total_frames']*sr/fps);dialogue=np.zeros((length,2),np.float32);sound=np.zeros_like(dialogue);cues=[];voice_envelope=np.ones(length,np.float32)
def add(track,a,sec,gain=1,pan=0):
 start=round(sec*sr);n=min(len(a),len(track)-start)
 if start<0 or n<=0:return
 if a.ndim==1:
  track[start:start+n,0]+=a[:n]*gain*math.sqrt((1-pan)/2);track[start:start+n,1]+=a[:n]*gain*math.sqrt((1+pan)/2)
 else:track[start:start+n]+=a[:n]*gain

def voice(a,t,character,kind):
 active=a[np.abs(a)>.007];rms=float(np.sqrt(np.mean(active**2))) if len(active) else .1;gain=min(2.8,.095/max(.03,rms));gain=min(gain,.78/max(.001,float(abs(a).max())))
 pan={'CHAR_MARK':-.08,'CHAR_LILI':.09,'CHAR_POTTY':-.12,'CHAR_ZIZI':.12,'CHAR_MORZSI':0}.get(character,0)
 add(dialogue,a,t,gain,pan);a0=max(0,round((t-.16)*sr));z0=min(length,round((t+len(a)/sr+.24)*sr));attack=min(round(.16*sr),z0-a0);release=min(round(.24*sr),z0-a0)
 env=np.full(z0-a0,.28,np.float32);env[:attack]=np.linspace(1,.28,attack);env[-release:]=np.linspace(.28,1,release);voice_envelope[a0:z0]=np.minimum(voice_envelope[a0:z0],env)
 cues.append({'type':kind,'character':character,'start_sec':t,'end_sec':t+len(a)/sr})
for b in x['beats']:
 if b['kind']=='DIALOGUE':voice(clips[b['recording_id']],b['audio_start_frame']/fps,b['character'],'DIALOGUE')
for r in reactions:voice(clips[r['id']],r['start_sec'],r['character'],'REACTION')
# Real field recordings and original generated material have distinct provenance.
assets={}
for name,file in [('birds','birds.ogg'),('bark','bark.wav'),('leaves1','steps/leaves01.ogg'),('leaves2','steps/leaves02.ogg'),('stone','steps/stone01.ogg'),('wood','steps/wood01.ogg')]:assets[name]=decode(out/'sfx'/file)
assets['whine']=decode(out/'sfx/dog/Dog/Sad Dog 1.wav')
# Crop one distinct bark from the CC0 source; never give Bogyó human dialogue.
bark=assets['bark'];win=np.convolve(abs(bark),np.ones(960)/960,mode='same');active=np.where(win>.12*win.max())[0];first=active[0];end=next((i for i in range(first+2400,len(win)) if win[i]<win.max()*.07),min(len(win),first+20000));assets['short_bark']=bark[max(0,first-1200):min(len(bark),end+1200)]
rng=np.random.default_rng(16016)
def noise(d,band=(200,5000),decay=2):
 n=round(d*sr);a=rng.normal(0,1,n);a=sosfilt(butter(2,band,btype='bandpass',fs=sr,output='sos'),a);a/=max(abs(a).max(),.01);t=np.arange(n)/sr;return (a*(1-np.exp(-50*t))*np.exp(-decay*t)).astype(np.float32)
def bell(freq,d=2.5):
 t=np.arange(round(d*sr))/sr;a=np.zeros(len(t));
 for k,amp,decay in [(1,1,1.6),(2.01,.23,2.4),(2.76,.13,3.5),(4.13,.06,4.6)]:a+=amp*np.sin(2*np.pi*freq*k*t)*np.exp(-decay*t)
 return (a*(1-np.exp(-150*t))*.7).astype(np.float32)
def effect(kind,t,d=1,gain=.12,pan=0):
 if kind=='bark':a=assets['short_bark']
 elif kind=='whine':a=assets['whine'][:round(2.8*sr)]
 elif kind in ('leaves1','leaves2','stone','wood'):a=assets[kind]
 elif kind=='glass':a=bell(1396.91,2)
 elif kind=='low':a=bell(261.625,d)
 elif kind=='high':a=bell(523.251,d)
 elif kind=='middle':a=bell(391.995,d)
 elif kind=='cloth':a=noise(d,(700,6500),3)
 elif kind=='wind':a=noise(d,(80,1200),.8)
 elif kind=='click':a=noise(.13,(400,9500),30)
 elif kind=='stone_rumble':a=noise(d,(40,240),.5)
 elif kind=='water':a=noise(d,(550,9000),.25)*.8
 elif kind=='portal':
  t1=np.arange(round(d*sr))/sr;a=noise(d,(150,1700),.4)+.35*np.sin(2*np.pi*(170*t1+70*t1*t1/d))*np.sin(np.pi*t1/d)**2
 elif kind=='chime':a=bell(1046.5,d)*.65+bell(1568,d)*.3
 else:raise RuntimeError(kind)
 add(sound,a,t,gain,pan);cues.append({'type':'SFX','name':kind,'start_sec':t,'end_sec':t+len(a)/sr})
# Forest ambience before and after the sky garden, with the scripted bird hush retained.
forest_ranges=[(0,map_time(366.2083)),(map_time(1119.25),map_time(1204.9583))]
for a,z in forest_ranges:
 birds=assets['birds'];gain=.004/max(.001,float(np.sqrt(np.mean(birds**2))))
 for t in np.arange(a,z,len(birds)/sr-.15):
  take=min(len(birds),round((z-t)*sr));clip=birds[:take].copy();fade=min(sr//5,len(clip)//2);clip[:fade]*=np.linspace(0,1,fade);clip[-fade:]*=np.linspace(1,0,fade)
  if t<map_time(41.875) and t+take/sr>map_time(31.875):
   lo=max(0,round((map_time(33)-t)*sr));hi=min(take,round((map_time(39.8)-t)*sr));clip[lo:hi]*=.03
  add(sound,clip,t,gain,.35)
# Gentle air, not silent dead space, in the sky garden.
a,z=map_time(366.2083),map_time(1119.25);wind=noise(z-a,(70,900),0);wind*=.35+.15*np.sin(np.arange(len(wind))/sr*.23);add(sound,wind,a,.006)
for b in x['beats']:
 if b['kind']!='ACTION' or b['scene'].endswith('019'):continue
 t=b['start_frame']/fps;z=b['end_frame']/fps;d=z-t;direction=b.get('direction_hu','').lower();scene=int(b['scene'][-3:])
 if any(w in direction for w in ['lépked','elindul','halad','sétál','od alép','odalép','átlép','visszamegy','visszatér','lép át','követik az ösvényt','át a','átsétál']):
  surface='leaves1' if scene<6 or scene>=17 else ('wood' if 'híd' in direction else 'stone')
  for j,a0 in enumerate(np.arange(t+.3,z-.3,.66)):
   if scene==1 and j in (4,5):continue
   effect('leaves2' if surface=='leaves1' and j%2 else surface,a0,gain=.035 if scene>1 else .07,pan=(-.18 if j%2 else .18))
 if any(w in direction for w in ['kendő','hátizsák','szalag','kosár','kulacs']):effect('cloth',t+.8,min(1.2,d-1),.035)
 if any(w in direction for w in ['dereng','ragyog','fény villan','fény erősöd','felvillan','fényfolyam']):effect('glass',t+d*.5,gain=.042)
 if any(w in direction for w in ['mutató','gépe','szerkezet','mindenmérő']):
  effect('click',t+.4,gain=.05);effect('click',t+min(2,d*.65),gain=.035,pan=.2)
 if any(w in direction for w in ['kattan','retesz','rögzíti','visszazár']):effect('click',z-1.0,gain=.085)
 if any(w in direction for w in ['víz','csepp','kulacsából']):effect('water',t+d*.35,min(2.5,d*.45),.018)
 if 'kőrezgés' in direction or 'kő felemelkedik' in direction:effect('stone_rumble',t+.5,min(2.5,d/2),.03)
 if 'légörvény' in direction or 'légpöffenés' in direction or 'légáram' in direction:effect('wind',t+1,min(3,d/2),.055)
 if 'fényfelület' in direction or 'lép át' in direction:effect('portal',t+1,min(4,d/2),.035)
 if 'bogyó' in direction and ('vakkant' in direction or 'ugatás' in direction):
  effect('bark',t+1,.5,.14); 
  if 'két' in direction:effect('bark',t+1.7,.5,.12)
 if 'halkan nyüszít' in direction and 'whine' in assets:effect('whine',t+1)
 if scene==8:
  if 'mélyen kong' in direction:effect('low',t+1.4,3,.16)
  if 'magasabb hang' in direction:effect('high',t+1.4,3,.14)
  if 'középső hang' in direction:effect('middle',t+1.4,3,.15)
 if scene==9 and 'összevissza' in direction:
  for dt,name in [(1.0,'high'),(1.05,'middle'),(1.15,'low'),(2.2,'high')]:effect(name,t+dt,2,.075)
 if (scene==13 and ('dallam' in direction)) or (scene==14 and 'mély hang' in direction) or (scene==15 and ('dallam' in direction or direction.startswith('mély hang'))):
  spacing=2.2 if d>=10 else 1.5
  for j,name in enumerate(['low','high','middle']):effect(name,t+1+j*spacing,2.0,.13)
 if direction.startswith('a teljes kert válaszol'):
  effect('wind',t+.5,7,.045);effect('water',t+2,10,.022);effect('chime',t+3,4,.06)
 if 'három rövid fény' in direction:
  for j in range(3):effect('glass',t+d*.5+j*.65,gain=.055)
 if 'üveges hang' in direction:effect('glass',t+.35,gain=.15)
# Load score from this retimed decision list; all layers end on the same sample.
with wave.open(str(out/'S1E1_original_orchestral_score_V016.wav')) as w:
 assert w.getframerate()==24000 and w.getnchannels()==2
 music=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float32).reshape(-1,2)/32768
music=resample_poly(music,2,1,axis=0)
if abs(len(music)-length)>2:raise RuntimeError('Music is not retimed against current performances')
music=music[:length];music*=3.5*voice_envelope[:,None]
# Lower the orchestration for the important three-note clues.
for b in x['beats']:
 if b['kind']=='ACTION' and int(b['scene'][-3:]) in (8,13,14,15) and any(w in b.get('direction_hu','').lower() for w in ['dallam','mély hang','mélyen kong','magasabb hang','középső hang']):music[round(b['start_frame']*sr/fps):round(b['end_frame']*sr/fps)]*=.16
fade=sr//3;music[:fade]*=np.linspace(0,1,fade)[:,None];music[-sr:]*=np.linspace(1,0,sr)[:,None]
# Opening and credits use clean theme, not forest Foley under the branded montage.
intro=next(b for b in x['beats'] if b['kind']=='INTRO');a,z=round(intro['start_frame']*sr/fps),round(intro['end_frame']*sr/fps);sound[a:z]*=.2;music[a:z]*=1.5
opening_start=intro['start_frame']/fps
for dt,kind,gain in [(.1,'chime',.06),(3.4,'wind',.035),(5.9,'wind',.03),(9.,'chime',.07),(10.1,'click',.035),(12.8,'glass',.045)]:effect(kind,opening_start+dt,.8,gain)
mix=dialogue+music+sound;peak=float(abs(mix).max());safe=min(1,.89/max(peak,.001));mix*=safe
raw=out/'S1E1_sound_edit_premaster_V016.wav'
with wave.open(str(raw),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr)
 for a0 in range(0,length,30*sr):w.writeframes((np.clip(mix[a0:a0+30*sr],-.99,.99)*32767).astype('<i2').tobytes())
(out/'sound_cues_V016.json').write_text(json.dumps(cues,ensure_ascii=False,indent=2));
qc={'duration_sec':length/sr,'total_frames':x['total_frames'],'dialogue_recordings':131,'reaction_recordings':len(reactions),'music_scenes':19,'sfx_cues':sum(c['type']=='SFX' for c in cues),'peak_before_master':float(abs(mix).max()),'clipped_samples':int((abs(mix)>=1).sum()),'audio_timing_rebuilt':True,'full_episode_animation_complete':False,'facial_animation_approved':False,'episode_finished':False,'status':'DIRECTED_FULL_LENGTH_SOUND_EDIT_REVIEW'}
(out/'sound_edit_QC_V016.json').write_text(json.dumps(qc,indent=2));print(json.dumps(qc),flush=True)
