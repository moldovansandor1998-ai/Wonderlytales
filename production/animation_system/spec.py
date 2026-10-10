"""Shared contracts. Pure Python: usable by authoring, queue and tests."""
import hashlib, json, math, os
from pathlib import Path

CAST = ('CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO')
QUADRUPEDS = {'CHAR_LILI','CHAR_BOGYO'}
VISEMES = ('X','A','B','C','D','E','F','G','H')
CLIPS = ('idle','walk','run','turn','jump','sit','talk','laugh','cry','surprise','fear','pickup','interact')
FACE_PROFILES = {
 'CHAR_MARK': {'mouth':[-.004,.769,.024,.013], 'eyes':[[-.059,.828,.022,.017],[.017,.831,.022,.018]], 'head_floor':.755},
 'CHAR_LILI': {'mouth':[-.145,.605,.021,.010], 'eyes':[[-.186,.722,.031,.028],[-.060,.700,.029,.030]], 'head_floor':.565},
 'CHAR_MORZSI': {'mouth':[.006,.708,.028,.015], 'eyes':[[-.017,.807,.033,.030],[.091,.779,.029,.030]], 'head_floor':.655},
 'CHAR_POTTY': {'mouth':[0,.566,.020,.012], 'eyes':[[0,.628,.036,.032],[.104,.652,.037,.030]], 'head_floor':.455},
 'CHAR_ZIZI': {'mouth':[.026,.674,.025,.012], 'eyes':[[-.097,.779,.028,.031],[-.002,.751,.029,.033]], 'head_floor':.685},
 'CHAR_BOGYO': {'mouth':[-.105,.575,.023,.012], 'eyes':[[-.178,.742,.028,.038],[-.019,.704,.032,.045]], 'head_floor':.575},
}
EMOTIONS = ('neutral','happy','sad','surprise','fear','curious','angry')

def canonical(data):return json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)
def fingerprint(data):return hashlib.sha256(canonical(data).encode()).hexdigest()
def digest(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for block in iter(lambda:f.read(2**20),b''):h.update(block)
 return h.hexdigest()
def atomic_json(path,data):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_name(path.name+'.tmp')
 with temp.open('w',encoding='utf-8') as f:f.write(json.dumps(data,indent=2,ensure_ascii=False,allow_nan=False));f.flush();os.fsync(f.fileno())
 os.replace(temp,path);fd=os.open(path.parent,os.O_DIRECTORY);os.fsync(fd);os.close(fd)
def smooth(x):
 x=max(0.,min(1.,x));return x*x*(3.-2.*x)
def lerp(a,b,u):return [x+(y-x)*u for x,y in zip(a,b)]
def number(value,label,minimum=None):
 if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or (minimum is not None and value<minimum):raise ValueError('Invalid '+label)
 return value
def vector(value,label):
 if not isinstance(value,list) or len(value)!=3:raise ValueError('Invalid '+label)
 for x in value:number(x,label)
 return value
def validate_scene(scene,registry):
 if scene.get('schema')!='WONDERLY_SCENE_V1':raise ValueError('Unsupported scene schema')
 if not scene.get('id') or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-' for c in scene['id']):raise ValueError('Unsafe scene id')
 fps=scene.get('fps',24)
 if fps!=24:raise ValueError('Native delivery requires 24 fps')
 duration=number(scene.get('duration'), 'duration',1/fps)
 if abs(duration*fps-round(duration*fps))>1e-7:raise ValueError('Duration must end on a frame')
 if scene.get('location') not in registry.get('locations',{}):raise ValueError('Unknown locked location')
 codes=[]
 for actor in scene.get('characters',[]):
  code=actor.get('code')
  if code not in registry['characters'] or code in codes:raise ValueError('Unknown or duplicate character')
  codes.append(code)
  if actor.get('version')!=registry['characters'][code]['version']:raise ValueError('Character version drift')
  vector(actor.get('position'),'position');number(actor.get('yaw',0),'yaw')
  intervals=[]
  for action in actor.get('actions',[]):
   if action.get('clip') not in CLIPS:raise ValueError('Unknown clip')
   a=number(action.get('start'),'action start',0);b=number(action.get('end'),'action end',0)
   if b<=a or b>duration:raise ValueError('Action out of range')
   if action.get('layer','body')=='body':intervals.append((a,b))
   if 'destination' in action:vector(action['destination'],'destination')
   if 'body_lower' in action:
    if action['clip']!='pickup' or not 0<=number(action['body_lower'],'pickup body lowering')<=.5:raise ValueError('Invalid pickup body lowering')
   if action.get('clip') in ('walk','run') and 'destination' not in action:raise ValueError('Locomotion requires destination')
  intervals.sort()
  if any(b>c+1e-7 for (a,b),(c,d) in zip(intervals,intervals[1:])):raise ValueError('Overlapping base actions')
 for actor in scene.get('characters',[]):
  for action in actor.get('actions',[]):
   if action.get('look_at') and (action['clip']!='turn' or action['look_at'] not in codes or action['look_at']==actor['code']):raise ValueError('Invalid body turn target')
  for gaze in actor.get('gaze',[]):
   if gaze.get('target') not in codes and gaze.get('target') not in ('camera','gate','prop'):raise ValueError('Missing gaze target')
   a=number(gaze.get('start'),'gaze start',0);b=number(gaze.get('end'),'gaze end',0)
   if b<=a or b>duration:raise ValueError('Gaze out of range')
 for event in scene.get('interactions',[]):
  if event.get('character') not in codes or event.get('kind') not in ('pickup','touch'):raise ValueError('Invalid interaction')
  if event.get('hand','R') not in ('L','R'):raise ValueError('Unknown hand')
  a=number(event.get('start'),'interaction start',0);b=number(event.get('end'),'interaction end',0);vector(event.get('position'),'interaction target')
  if b<=a or b>duration:raise ValueError('Interaction out of range')
 speakers={};line_ids=set()
 for line,offscreen in [(line,False) for line in scene.get('dialogue',[])]+[(line,True) for line in scene.get('offscreen_dialogue',[])]:
  if not line.get('id') or line['id'] in line_ids:raise ValueError('Missing or duplicate dialogue id')
  line_ids.add(line['id'])
  if line.get('speaker') not in codes:raise ValueError('Dialogue speaker is absent')
  a=number(line.get('start'),'speech start',0);b=number(line.get('end'),'speech end',0)
  if b<=a or b>duration:raise ValueError('Speech out of range')
  if not line.get('audio') or (not offscreen and not line.get('visemes')):raise ValueError('Speech requires real audio and aligned viseme file')
  speakers.setdefault(line['speaker'],[]).append((a,b))
 for ranges in speakers.values():
  ranges.sort()
  if any(b>c+1e-7 for (a,b),(c,d) in zip(ranges,ranges[1:])):raise ValueError('Overlapping speech on one mouth')
 cameras=scene.get('cameras',[])
 if not cameras or cameras[0].get('start')!=0:raise ValueError('First camera must start at zero')
 times=[]
 for camera in cameras:
  times.append(number(camera.get('start'),'camera start',0));vector(camera.get('position'),'camera position');vector(camera.get('target'),'camera target')
  if 'end_position' in camera:vector(camera['end_position'],'camera end position')
  if 'end_target' in camera:
   if 'end_position' not in camera:raise ValueError('Moving camera target requires a motion endpoint')
   vector(camera['end_target'],'camera end target')
  if not 8<=camera.get('lens',40)<=200:raise ValueError('Invalid lens')
 if times!=sorted(set(times)) or times[-1]>=duration:raise ValueError('Invalid camera cuts')
 return scene

def compile_episode(episode,registry,max_job_frames=360):
 if episode.get('schema')!='WONDERLY_EPISODE_V1':raise ValueError('Unsupported episode schema')
 if not 1<=max_job_frames<=360:raise ValueError('Render job bound is 360 frames')
 scenes=episode.get('scenes',[]);ids=set();jobs=[];offset=0
 for scene in scenes:
  validate_scene(scene,registry)
  if scene['id'] in ids:raise ValueError('Duplicate scene id')
  ids.add(scene['id']);count=round(scene['duration']*24)
  locked={x['code']:registry['characters'][x['code']]['asset_sha256'] for x in scene['characters']}
  for start in range(1,count+1,max_job_frames):
   end=min(count,start+max_job_frames-1)
   job={'scene_id':scene['id'],'frame_start':start,'frame_end':end,'frames':end-start+1,'episode_start_frame':offset+start,'scene_fingerprint':fingerprint(scene),'assets':locked,'location_sha256':registry['locations'][scene['location']]['asset_sha256']}
   if scene.get('compiled_scene_sha256'):job['compiled_scene_sha256']=scene['compiled_scene_sha256']
   if episode.get('renderer_sha256'):job['renderer_sha256']=episode['renderer_sha256']
   job['id']=fingerprint(job)[:24];jobs.append(job)
  offset+=count
 target=episode.get('target_duration_seconds',3600)
 if episode.get('kind')=='film' and (offset<40*60*24 or offset!=round(target*24)):raise ValueError('Film must contain >=40 minutes of actual scripted scene time and match target')
 return {'schema':'WONDERLY_RENDER_PLAN_V1','system_version':'V021','episode_id':episode['id'],'fps':24,'frames':offset,'duration_seconds':offset/24,'scene_count':len(scenes),'jobs':jobs,'production_approved':False}
