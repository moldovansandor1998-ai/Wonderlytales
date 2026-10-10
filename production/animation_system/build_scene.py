"""Validated script + frozen masters + reusable clips -> native animated scene."""
import sys, json, math, os, random
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import bpy
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
from animation_system.spec import validate_scene, digest, atomic_json, smooth, QUADRUPEDS
from animation_system.motion import root_at, active_action, foot_at, foot_heading, support_shift, CATALOG
from animation_system.facial import FORMS, driver
from animation_system.lipsync import weights_at, validate_track

def curve(action,path,axis,frame):
 fc=action.fcurves.find(path,index=axis) if action else None;return fc.evaluate(frame) if fc else 0.

def template_sample(r,spec,clip,elapsed,action_duration):
 action=bpy.data.actions.get(next(n for n in spec['actions'] if '::'+clip+'::' in n));seconds=CATALOG[clip]['seconds']
 phase=elapsed%seconds if CATALOG[clip]['loop'] else min(seconds,max(0,elapsed/max(.001,action_duration)*seconds));frame=1+phase*24
 result={}
 for name in ['pelvis','spine','chest','neck','head','upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R']:
  key='CTRL_'+name if name in spec['torso_controls'] else name
  if key in r.pose.bones:result[key]=[curve(action,'pose.bones["'+key+'"].rotation_euler',i,frame) for i in range(3)]
 face={prop:curve(action,'["'+prop+'"]',0,frame) for prop in ['smile','frown','brow_up','brow_down','squint','eye_wide']}
 return result,face

def set_target(r,bone,point,yaw=None):
 p=r.pose.bones[bone];local=r.matrix_world.inverted()@Vector(point);p.location=p.bone.matrix_local.inverted()@local
 p.keyframe_insert('location')
 if yaw is not None:
  desired=Matrix.Rotation(yaw,4,'Z').to_quaternion()@p.bone.matrix_local.to_quaternion()
  p.rotation_mode='QUATERNION';p.rotation_quaternion=p.bone.matrix_local.to_quaternion().inverted()@r.matrix_world.to_quaternion().inverted()@desired;p.keyframe_insert('rotation_quaternion')

def terrain(scene):
 trees=[]
 for o in scene.objects:
  if o.type=='MESH' and not o.hide_render and any(n in o.name.lower() for n in ['forest floor','forest path','woodland terrain','bridge deck']):
   ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();trees.append(BVHTree.FromPolygons([ev.matrix_world@v.co for v in m.vertices],[p.vertices[:] for p in m.polygons]));ev.to_mesh_clear()
 def height(x,y):
  hits=[]
  for tree in trees:
   p,n,*_=tree.ray_cast(Vector((x,y,5)),Vector((0,0,-1)),10)
   if p is not None and n.z>.45:hits.append(p.z)
  return max(hits) if hits else 0.
 return height

def main(master,registry_path,script_path,dest):
 registry=json.loads(registry_path.read_text());script=json.loads(script_path.read_text());validate_scene(script,registry)
 if digest(master)!=next(iter(registry['characters'].values()))['asset_sha256']:raise ValueError('Frozen master checksum differs')
 bpy.ops.wm.open_mainfile(filepath=str(master),use_scripts=False);s=bpy.context.scene;codes={a['code'] for a in script['characters']}
 if script.get('studio'):
  for o in list(bpy.data.collections[registry['locations'][script['location']]['collection']].objects):bpy.data.objects.remove(o,do_unlink=True)
  bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01));floor=bpy.context.object;floor.name='forest floor studio';mat=bpy.data.materials.new('Studio ground');mat.diffuse_color=(.11,.15,.20,1);floor.data.materials.append(mat)
  s.world=bpy.data.worlds.new('Studio world');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.19,.23,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
  for loc,power,size in [((-3,-4,5),650,5),((3,-2,3),400,4),((1,2,4),700,3)]:
   bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
 for code,spec in registry['characters'].items():
  if code not in codes:
   for o in list(bpy.data.collections[spec['collection']].objects):bpy.data.objects.remove(o,do_unlink=True)
 floor=terrain(s);actors={a['code']:a for a in script['characters']};rigs={c:bpy.data.objects[registry['characters'][c]['rig']] for c in codes};roots={c:bpy.data.objects[registry['characters'][c]['root']] for c in codes}
 for c,actor in actors.items():
  for action in actor.get('actions',[]):
   if action.get('look_at'):
    own=root_at(actor,action['start'])[0];target=root_at(actors[action['look_at']],action['end'])[0];action['yaw']=math.atan2(target[0]-own[0],own[1]-target[1])
 tracks={}
 for line in script.get('dialogue',[]):
  audio=(script_path.parent/line['audio']).resolve();path=(script_path.parent/line['visemes']).resolve();track=json.loads(path.read_text())
  if digest(audio)!=track['audio_sha256']:raise ValueError('Audio changed after viseme timing')
  validate_track(track)
  tracks[line['id']]=track
 count=round(script['duration']*24);contact_events=[];contacts=[];mouth_states=[]
 blinks={c:[] for c in codes}
 for ci,c in enumerate(sorted(codes)):
  rng=random.Random(script.get('seed',21021)+ci);t=rng.uniform(1.6,3.5)
  while t<script['duration']:blinks[c].append(t);t+=rng.uniform(3.2,6.6)
  r=rigs[c];r.animation_data_create();r.animation_data.action=bpy.data.actions.new(script['id']+'::'+c+'::compiled');r.animation_data.action['uses_clip_library']='V021'
 state={};gaze_targets={}
 for c,r in rigs.items():
  target=bpy.data.objects.new(c+'_GAZE_TARGET_V021',None);s.collection.objects.link(target);gaze_targets[c]=target;r['auto_gaze']=0.
  for side in ('L','R'):
   bone=r.pose.bones['eye.'+side];con=bone.constraints.new('DAMPED_TRACK');con.name='Native 3D gaze';con.target=target;con.track_axis='TRACK_Y';driver(con,'influence',r,'auto_gaze','max(0,min(1,c))')
   limit=bone.constraints.new('LIMIT_ROTATION');limit.name='Anatomical eye range';limit.owner_space='LOCAL';limit.use_limit_x=True;limit.min_x=-.5;limit.max_x=.5;limit.use_limit_z=True;limit.min_z=-.6;limit.max_z=.6
 for f in range(1,count+1):
  s.frame_set(f);t=(f-1)/24
  for c,a in actors.items():
   pos,yaw=root_at(a,t);root=roots[c];root.location=pos;root.rotation_euler.z=yaw;root.keyframe_insert('location');root.keyframe_insert('rotation_euler',index=2)
  bpy.context.view_layer.update()
  for c,a in actors.items():
   r=rigs[c];spec=registry['characters'][c];clip=active_action(a,t);rotation,face=template_sample(r,spec,clip['clip'],t-clip['start'],clip['end']-clip['start'])
   transition=smooth((t-clip['start'])/.16)
   if transition<1:
    previous=active_action(a,clip['start']-1/24);old_pose,old_face=template_sample(r,spec,previous['clip'],max(0,clip['start']-1/24-previous['start']),previous['end']-previous['start'])
    rotation={k:[x+(y-x)*transition for x,y in zip(old_pose.get(k,[0,0,0]),values)] for k,values in rotation.items()};face={k:old_face.get(k,0)+(v-old_face.get(k,0))*transition for k,v in face.items()}
   # Base library poses and timed dialogue gestures share the same rig contract.
   line=next((l for l in script.get('dialogue',[]) if l['speaker']==c and l['start']<=t<l['end']),None)
   if line and clip['clip']!='talk':
    speech_pose,speech_face=template_sample(r,spec,'talk',t-line['start'],line['end']-line['start'])
    for bone in speech_pose:
     if bone not in ['CTRL_pelvis']:rotation[bone]=[x+y for x,y in zip(rotation.get(bone,[0,0,0]),speech_pose[bone])]
   # Targeted eye motion is independent of the head, with delayed head follow.
   gaze=next((g for g in a.get('gaze',[]) if g['start']<=t<g['end']),None)
   yaw_eye=pitch_eye=0.
   if gaze:
    target=gaze['target']
    if target in actors:world_target=rigs[target].matrix_world@rigs[target].data.bones['head'].head_local
    else:world_target=Vector(gaze.get('position',[0,5,1]))
    origin=r.matrix_world@r.data.bones['head'].head_local;direction=r.matrix_world.to_quaternion().inverted()@(world_target-origin);desired=math.atan2(direction.x,-direction.y);desired=max(-.5,min(.5,desired));follow=smooth((t-gaze['start']-.10)/.45)
    head=rotation.setdefault('CTRL_head',[0,0,0]);head[1]+=desired*.50*follow;desired_pitch=math.atan2(direction.z,max(.01,math.hypot(direction.x,direction.y)));head[0]-=max(-.35,min(.35,desired_pitch*.5))*follow;yaw_eye=pitch_eye=0.
   r['auto_gaze']=float(gaze is not None);r.keyframe_insert('["auto_gaze"]')
   for bone,values in rotation.items():
    p=r.pose.bones[bone];p.rotation_mode='XYZ';p.rotation_euler=values;p.keyframe_insert('rotation_euler')
   # Independent supporting-pelvis translation and breathing; feet remain fixed.
   pelvis=r.pose.bones['CTRL_pelvis'];shift=Vector(support_shift(a,t))
   pelvis.location=pelvis.bone.matrix_local.to_3x3().inverted()@shift
   pelvis.keyframe_insert('location')
   for foot in spec['feet']:
    foot={**foot,'leg_length':sum(r.data.bones[n].length for n in (foot['upper'],foot['lower']))}
    q,planted,contact=foot_at(a,foot,t,spec['scale']);rest_z=foot['ankle'][2]*spec['scale'];lift=q[2]-(roots[c].location.z+rest_z)
    q[2]=floor(q[0],q[1])+(foot['ankle'][2]-foot['sole_z'])*spec['scale']+.003+max(0,lift)
    set_target(r,foot['control'],q,foot_heading(a,foot,t))
    contacts.append({'frame':f,'character':c,'foot':foot['foot'],'planted':planted,'contact':str(clip['start'])+':'+clip['clip']+':'+contact,'target':q})
    key=(c,foot['foot']);prior=state.get(key)
    if planted and prior!=contact:
     contact_events.append({'time':t,'character':c,'foot':foot['foot'],'position':q});state[key]=contact
   for side in ('L','R'):
    for prop,value in [('gaze_yaw.'+side,yaw_eye),('gaze_pitch.'+side,pitch_eye)]:r[prop]=value;r.keyframe_insert('["'+prop+'"]')
    blink=max((smooth((t-bt+.07)/.07) if t<bt else 1-smooth((t-bt)/.12) for bt in blinks[c] if -.07<=t-bt<=.12),default=0.)
    r['blink.'+side]=blink;r.keyframe_insert('["blink.'+side+'"]')
   for prop,value in face.items():r[prop]=value;r.keyframe_insert('["'+prop+'"]')
   weights=weights_at(tracks[line['id']],t-line['start']) if line else {v:float(v=='X') for v in FORMS}
   for name,value in weights.items():r['viseme_'+name]=value;r.keyframe_insert('["viseme_'+name+'"]')
   r['jaw_open']=sum(weights[v]*FORMS[v][4] for v in weights)/.12;r.keyframe_insert('["jaw_open"]')
   if line:mouth_states.append({'frame':f,'character':c,'weights':weights})
  bpy.context.view_layer.update()
  for c,a in actors.items():
   gaze=next((g for g in a.get('gaze',[]) if g['start']<=t<g['end']),None)
   if gaze:
    target=gaze['target']
    if target in rigs:
     other=rigs[target];point=other.matrix_world@((other.pose.bones['eye.L'].head+other.pose.bones['eye.R'].head)*.5)
    else:point=Vector(gaze.get('position',[0,5,1]))
    gaze_targets[c].location=point;gaze_targets[c].keyframe_insert('location')
  if f%240==0:print('COMPILED_FRAMES',f,count,flush=True)
 # Evaluated contact helper is also rerun after final support baking.
 from animation_system.interactions import author_interactions
 interaction_report=author_interactions(s,script,rigs)
 s.timeline_markers.clear()
 for i,view in enumerate(script['cameras']):
  data=bpy.data.cameras.new(script['id']+' camera '+str(i));cam=bpy.data.objects.new(data.name,data);s.collection.objects.link(cam);cam.location=view['position'];cam.rotation_euler=(Vector(view['target'])-cam.location).to_track_quat('-Z','Y').to_euler();data.lens=view.get('lens',40)
  marker=s.timeline_markers.new('CUT_'+str(i),frame=round(view['start']*24)+1);marker.camera=cam
  if i==0:s.camera=cam
  if 'end_position' in view:
   end=script['cameras'][i+1]['start'] if i+1<len(script['cameras']) else script['duration']
   start_frame=round(view['start']*24)+1;end_frame=round(end*24)
   for frame in range(start_frame,end_frame+1):
    u=smooth((frame-start_frame)/max(1,end_frame-start_frame))
    cam.location=Vector(view['position']).lerp(Vector(view['end_position']),u)
    target=Vector(view['target']).lerp(Vector(view.get('end_target',view['target'])),u)
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.keyframe_insert('location',frame=frame);cam.keyframe_insert('rotation_euler',frame=frame)
   for fc in cam.animation_data.action.fcurves:
    for key in fc.keyframe_points:key.interpolation='LINEAR'
 for o in [*rigs.values(),*roots.values()]:
  if o.animation_data and o.animation_data.action:
   for fc in o.animation_data.action.fcurves:
    for key in fc.keyframe_points:key.interpolation='LINEAR'
 s.frame_start=1;s.frame_end=count;s.render.fps=24;s.render.use_sequencer=False;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s['production_approved']=False;s['system_version']='V021';s['script_sha256']=digest(script_path)
 s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
 with dest.open('rb') as file:os.fsync(file.fileno())
 atomic_json(dest.with_suffix('.compiled.json'),{'scene':script['id'],'master_sha256':digest(master),'scene_sha256':digest(dest),'script_sha256':digest(script_path),'frames':count,'cast':sorted(codes),'interaction_report':interaction_report,'contacts':contacts,'contact_events':contact_events,'mouth_states':mouth_states,'clip_library_consumed':True,'professional_quality_approved':False})
 print('SCENE_COMPILED',script['id'],count,flush=True)

if __name__=='__main__':
 master,registry,script,dest=map(Path,sys.argv[sys.argv.index('--')+1:]);main(master.resolve(),registry.resolve(),script.resolve(),dest.resolve())
