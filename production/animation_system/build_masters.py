"""One-time master authoring. Scene generation appends these frozen collections."""
import sys, json, math, os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import bpy
import numpy as np
from mathutils import Vector
from animation_system.spec import CAST, QUADRUPEDS, FACE_PROFILES, CLIPS, atomic_json, digest, smooth
from animation_system.facial import build_face, driver
from animation_system.motion import CATALOG, pose_at, face_at

def move_collection(obj,col):
 for old in list(obj.users_collection):old.objects.unlink(obj)
 col.objects.link(obj)

def ctrl_bone(r,name,source,parent='root'):
 b=r.data.edit_bones.new(name);s=r.data.edit_bones[source];b.head=s.head;b.tail=s.tail;b.roll=s.roll;b.parent=r.data.edit_bones.get(parent);b.use_deform=False
 return b

def setup_controls(r,body,code):
 old_angles={p.name:c.pole_angle for p in r.pose.bones for c in p.constraints if c.type=='IK'}
 for p in r.pose.bones:
  for c in list(p.constraints):p.constraints.remove(c)
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True);bpy.context.view_layer.objects.active=r;bpy.ops.object.mode_set(mode='EDIT')
 torso=['pelvis','spine','neck','head']+(['chest'] if 'chest' in r.data.edit_bones else [])
 for name in torso:ctrl_bone(r,'CTRL_'+name,name)
 feet=[]
 if code in QUADRUPEDS:
  for part in ('fore','hind'):
   for side in ('L','R'):
    upper=r.data.edit_bones[part+'leg.'+side];paw=r.data.edit_bones[part+'paw.'+side];ankle=paw.head.copy()
    joint=upper.head.lerp(ankle,.52);joint.y+=.025 if part=='fore' else -.025
    upper.tail=joint;lower=r.data.edit_bones.new(part+'shin.'+side);lower.head=joint;lower.tail=ankle;lower.parent=upper;lower.use_deform=True;paw.parent=lower
    ctrl_bone(r,'CTRL_'+part+'paw.'+side,part+'paw.'+side)
    pole=r.data.edit_bones.new('CTRL_'+part+'knee.'+side);pole.head=joint+Vector((0,-.26 if part=='fore' else .26,.02));pole.tail=pole.head+Vector((0,0,.04));pole.parent=r.data.edit_bones['root'];pole.use_deform=False
    feet.append({'lower':part+'shin.'+side,'foot':part+'paw.'+side,'upper':part+'leg.'+side,'control':'CTRL_'+part+'paw.'+side,'pole':'CTRL_'+part+'knee.'+side,'phase':0 if (part,side) in [('fore','L'),('hind','R')] else .5})
 else:
  for side in ('L','R'):
   ctrl_bone(r,'CTRL_foot.'+side,'foot.'+side)
   pole=r.data.edit_bones.new('CTRL_knee.'+side);pole.head=r.data.edit_bones['shin.'+side].head+Vector((0,-.30,.03));pole.tail=pole.head+Vector((0,0,.05));pole.parent=r.data.edit_bones['root'];pole.use_deform=False
   feet.append({'lower':'shin.'+side,'foot':'foot.'+side,'upper':'thigh.'+side,'control':'CTRL_foot.'+side,'pole':'CTRL_knee.'+side,'phase':0 if side=='L' else .5})
   ctrl_bone(r,'CTRL_hand.'+side,'hand.'+side)
   pole=r.data.edit_bones.new('CTRL_elbow.'+side);pole.head=r.data.edit_bones['forearm.'+side].head+Vector((.35 if side=='L' else -.35,-.08,0));pole.tail=pole.head+Vector((0,0,.05));pole.parent=r.data.edit_bones['root'];pole.use_deform=False
 bpy.ops.object.mode_set(mode='OBJECT')
 for name in torso:
  con=r.pose.bones[name].constraints.new('COPY_ROTATION');con.name='Master '+name+' control';con.target=r;con.subtarget='CTRL_'+name;con.target_space='LOCAL';con.owner_space='LOCAL'
  if name=='pelvis':
   con=r.pose.bones[name].constraints.new('COPY_LOCATION');con.name='Master weight shift';con.target=r;con.subtarget='CTRL_'+name;con.target_space='LOCAL';con.owner_space='LOCAL'
 for foot in feet:
  p=r.pose.bones[foot['lower']];con=p.constraints.new('IK');con.name='Master planted foot';con.target=r;con.subtarget=foot['control'];con.pole_target=r;con.pole_subtarget=foot['pole'];con.chain_count=2;con.use_stretch=False;con.pole_angle=old_angles.get(foot['lower'],0.)
  rotate=r.pose.bones[foot['foot']].constraints.new('COPY_ROTATION');rotate.name='Master sole orientation';rotate.target=r;rotate.subtarget=foot['control'];rotate.target_space='WORLD';rotate.owner_space='WORLD'
  foot['ankle']=list(r.data.bones[foot['foot']].head_local);foot['sole_z']=float(min(v.co.z for v in body.data.vertices if abs(v.co.x-foot['ankle'][0])<.09 and abs(v.co.y-foot['ankle'][1])<.14))
  foot['rest_rotation']=list(r.data.bones[foot['foot']].matrix_local.to_quaternion())
 if code not in QUADRUPEDS:
  for side in ('L','R'):
   p=r.pose.bones['forearm.'+side];con=p.constraints.new('IK');con.name='Master hand contact';con.target=r;con.subtarget='CTRL_hand.'+side;con.pole_target=r;con.pole_subtarget='CTRL_elbow.'+side;con.chain_count=2;con.use_stretch=False
   r['ik_hand.'+side]=0.;driver(con,'influence',r,'ik_hand.'+side,'max(0,min(1,c))')
 # Resolve pole roll geometrically at a neutral, planted test pose.
 for foot in feet:
  con=next(c for c in r.pose.bones[foot['lower']].constraints if c.type=='IK');best=(-1e9,0)
  for k in range(32):
   con.pole_angle=-math.pi+k*math.tau/32;bpy.context.view_layer.update()
   hip=r.pose.bones[foot['upper']].head;knee=r.pose.bones[foot['lower']].head;ankle=r.pose.bones[foot['lower']].tail;pole=r.pose.bones[foot['pole']].head
   axis=(ankle-hip).normalized();a=knee-hip;a-=axis*a.dot(axis);b=pole-hip;b-=axis*b.dot(axis)
   # Preserve the skin's bind orientation as well as the bend plane. A nearly
   # straight chain cannot resolve roll from knee position alone.
   score=-sum((r.data.bones[name].matrix_local.to_quaternion().rotation_difference(r.pose.bones[name].matrix.to_quaternion()).angle)**2 for name in (foot['upper'],foot['lower']))
   if score>best[0]:best=(score,con.pole_angle)
  con.pole_angle=best[1];foot['pole_angle']=best[1]
 return feet,torso

def refine_binding(body,r,code):
 body.shape_key_clear()
 # Legacy jaw influenced the baked face; all mouth deformation now belongs to
 # the retopologized facial surface and independently skinned oral parts.
 jaw=body.vertex_groups.get('jaw');head=body.vertex_groups.get('head')
 if jaw:
  for v in body.data.vertices:
   old={g.group:g.weight for g in v.groups};w=old.get(jaw.index,0)
   if w:head.add([v.index],old.get(head.index,0)+w,'REPLACE')
  body.vertex_groups.remove(jaw)
 protected={g.index for g in body.vertex_groups if g.name.startswith(('ear','tail'))}
 if code!='CHAR_MARK':
  # Rebind continuously to the complete anatomical chain. Keeping the legacy
  # hard leg labels creates stretched triangles when IK starts bending joints.
  bones=[b for b in r.data.bones if b.use_deform and b.name not in ('root','jaw','eye.L','eye.R') and not b.name.startswith(('ear','tail'))]
  points=np.array([v.co[:] for v in body.data.vertices]);dist=[]
  for bone in bones:
   a=np.array(bone.head_local[:]);b=np.array(bone.tail_local[:]);axis=b-a;u=np.clip((points-a)@axis/max(1e-8,float(axis@axis)),0,1);nearest=a+u[:,None]*axis;dist.append(np.linalg.norm(points-nearest,axis=1))
  values=(np.array(dist).T+.025)**-4;values/=values.sum(axis=1)[:,None]
  groups=[body.vertex_groups.get(b.name) or body.vertex_groups.new(name=b.name) for b in bones]
  for i,v in enumerate(body.data.vertices):
   old={g.group:g.weight for g in v.groups};mass=sum(w for idx,w in old.items() if idx not in protected)
   for idx in old:
    if idx not in protected:body.vertex_groups[idx].remove([i])
   for group,w in zip(groups,values[i]):
    if w>1e-5:group.add([i],float(w*mass),'REPLACE')
 threshold=FACE_PROFILES[code]['head_floor'];changed=0
 for v in body.data.vertices:
  z=v.co.z
  mask=smooth((z-threshold)/.025)
  if code in QUADRUPEDS:mask*=smooth((.08-v.co.y)/.06)
  if code=='CHAR_POTTY' and z>.70:mask=0 # retain independent long ears
  if mask<=0:continue
  old={g.group:g.weight for g in v.groups};total=sum(w for i,w in old.items() if i not in protected)
  for i,w in old.items():
   if i not in protected:body.vertex_groups[i].add([v.index],w*(1-mask),'REPLACE')
  head.add([v.index],old.get(head.index,0)*(1-mask)+total*mask,'REPLACE');changed+=1
 if code=='CHAR_MARK':
  for v in body.data.vertices:
   z=v.co.z
   if z>.755:continue
   old={g.group:g.weight for g in v.groups};locked=sum(w for i,w in old.items() if i in protected);available=max(0,sum(old.values())-locked)
   arm=smooth((abs(v.co.x)-.14)/.055)*smooth((z-.28)/.08)*smooth((.755-z)/.06)
   side='L' if v.co.x>0 else 'R';upper=smooth((z-.495)/.105);hand=1-smooth((z-.43)/.055)
   head=smooth((z-.72)/.035);neck=(1-head)*smooth((z-.685)/.06);chest=(1-head-neck)*smooth((z-.585)/.085)
   spine=(1-head-neck-chest)*smooth((z-.43)/.075);trunk=head+neck+chest+spine
   pelvis=(1-trunk)*smooth((z-.34)/.075);leg=1-trunk-pelvis
   shin=1-smooth((z-.245)/.095);foot=1-smooth((z-.10)/.065)
   left=smooth((v.co.x+.035)/.07)
   bindings={'head':head,'neck':neck,'chest':chest,'spine':spine,'pelvis':pelvis}
   for sd,sw in [('L',left),('R',1-left)]:
    bindings['thigh.'+sd]=leg*sw*(1-shin);bindings['shin.'+sd]=leg*sw*shin*(1-foot);bindings['foot.'+sd]=leg*sw*shin*foot
   bindings={k:w*(1-arm) for k,w in bindings.items()}
   bindings['upper_arm.'+side]=arm*upper;bindings['forearm.'+side]=arm*(1-upper)*(1-hand);bindings['hand.'+side]=arm*(1-upper)*hand
   for i in old:
    if i not in protected:body.vertex_groups[i].remove([v.index])
   for name,w in bindings.items():
    if w>0:body.vertex_groups[name].add([v.index],w*available,'REPLACE')
 if code in QUADRUPEDS:
  for part in ('fore','hind'):
   for side in ('L','R'):
    upper=body.vertex_groups.get(part+'leg.'+side);paw=body.vertex_groups.get(part+'paw.'+side)
    if not upper or not paw:continue
    lower=body.vertex_groups.get(part+'shin.'+side) or body.vertex_groups.new(name=part+'shin.'+side);joint=r.data.bones[part+'shin.'+side].head_local.z;top=r.data.bones[part+'leg.'+side].head_local.z;ankle=r.data.bones[part+'paw.'+side].head_local.z
    for v in body.data.vertices:
     old={g.group:g.weight for g in v.groups};mass=old.get(upper.index,0)+old.get(paw.index,0)+old.get(lower.index,0)
     if mass<1e-5:continue
     foot=1-smooth((v.co.z-ankle)/max(.025,joint-ankle));thigh=smooth((v.co.z-joint)/max(.025,(top-joint)*.7))
     upper.add([v.index],mass*(1-foot)*thigh,'REPLACE');lower.add([v.index],mass*(1-foot)*(1-thigh),'REPLACE');paw.add([v.index],mass*foot,'REPLACE')
 for m in body.modifiers:
  if m.type=='ARMATURE':m.use_deform_preserve_volume=True
 return changed

def library(r,code,torso):
 driver_channels={(f.data_path,f.array_index) for f in r.animation_data.drivers} if r.animation_data else set()
 actions=[]
 for clip in CLIPS:
  r.animation_data_create();r.animation_data.action=None;action=bpy.data.actions.new(code+'::'+clip+'::V021');action.use_fake_user=True;r.animation_data.action=action
  count=round(CATALOG[clip]['seconds']*24)
  for f in range(1,count+2,2):
   t=(f-1)/24
   for name,rotation in pose_at(code,clip,t,CATALOG[clip]['seconds']).items():
    bone=r.pose.bones.get('CTRL_'+name if name in torso else name)
    if bone:bone.rotation_mode='XYZ';bone.rotation_euler=rotation;bone.keyframe_insert('rotation_euler',frame=f)
   for prop,value in face_at(clip,t).items():r[prop]=value;r.keyframe_insert('["'+prop+'"]',frame=f)
  action.asset_mark();action.asset_data.description=f'{code}, {clip}: reusable V021 DEVELOPMENT action; artist review pending';action['clip']=clip;action['anatomy']='quadruped' if code in QUADRUPEDS else 'biped';action['artist_approved']=False;actions.append(action.name)
 r.animation_data.action=None
 for p in r.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
 for prop in ['smile','frown','brow_up','brow_down','squint','eye_wide']:r[prop]=0
 if {(f.data_path,f.array_index) for f in r.animation_data.drivers}!=driver_channels:raise RuntimeError('Action authoring removed facial drivers')
 return actions

def main(source,out):
 out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);s=bpy.context.scene;s.frame_set(1)
 registry={'schema':'WONDERLY_ASSET_REGISTRY_V1','version':'V021','source_sha256':digest(source),'characters':{},'locations':{},'master_file':'MASTER_CAST_V021.blend','professional_quality_approved':False}
 for code in CAST:
  r=next(o for o in s.objects if o.type=='ARMATURE' and code in o.name)
  body=max((o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==r for m in o.modifiers)),key=lambda o:len(o.data.vertices));root=r.parent
  original_world=body.matrix_world.copy();r.animation_data_clear();root.animation_data_clear();root.location=(0,0,0);root.rotation_euler=(0,0,0)
  r.location=(0,0,0);r.rotation_euler=(0,0,0)
  for p in r.pose.bones:
   p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0);p.scale=(1,1,1)
  body.animation_data_clear();body.hide_render=False;body.hide_viewport=False;r.hide_viewport=False
  for o in list(s.objects):
   if o not in (body,r,root) and o.type=='MESH' and (code in o.name or any(m.type=='ARMATURE' and m.object==r for m in o.modifiers)):bpy.data.objects.remove(o,do_unlink=True)
  # Existing controller targets cannot be left in a frozen master collection.
  feet,torso=setup_controls(r,body,code);changed=refine_binding(body,r,code);face=build_face(s,body,r,code)
  col=bpy.data.collections.new(code+'_MASTER_V021');s.collection.children.link(col)
  objects=[body,r,root]+[o for o in s.objects if o.type=='MESH' and o.parent==r and o!=body]
  for o in objects:move_collection(o,col)
  actions=library(r,code,torso);r['rig_contract']='WONDERLY_RIG_V1';r['character_code']=code;r['asset_version']='V021'
  registry['characters'][code]={'version':'V021','collection':col.name,'rig':r.name,'body':body.name,'root':root.name,'scale':float(root.scale.x),'anatomy':'quadruped' if code in QUADRUPEDS else 'biped','feet':feet,'torso_controls':torso,'face':face,'actions':actions,'binding_vertices_refined':changed,'controls':[b.name for b in r.data.bones if b.name.startswith('CTRL_')]+['eye.L','eye.R','jaw'],'source_identity_preserved':True,'asset_sha256':'PENDING'}
  print('MASTER_AUTHORED',code,len(actions),flush=True)
 # Dedicated location asset, without character actions or legacy constraints.
 location=bpy.data.collections.new('LOC_FOREST_MASTER_V021');s.collection.children.link(location)
 for o in list(s.objects):
  if any(code in o.name for code in CAST) or any(o in col.objects.values() for col in bpy.data.collections if col.name.endswith('_MASTER_V021') and col.name.startswith('CHAR_')):continue
  if o.type in ('MESH','LIGHT') and not o.hide_render:
   centre=o.matrix_world.translation
   if abs(centre.x)<18 and abs(centre.y)<25 and not any(n in o.name.lower() for n in ['carried protective','story cloth','story star fragment','stone chip','floating']):
    o.animation_data_clear();move_collection(o,location)
 registry['locations']['LOC_FOREST_V021']={'version':'V021','collection':location.name,'asset_sha256':'PENDING','artist_approved':False}
 # Persist only master collections, not the old 21-minute action database.
 retained={o for c in [location]+[bpy.data.collections[v['collection']] for v in registry['characters'].values()] for o in c.objects}
 for o in list(s.objects):
  if o not in retained:bpy.data.objects.remove(o,do_unlink=True)
 for action in list(bpy.data.actions):
  if not action.name.endswith('::V021'):bpy.data.actions.remove(action)
 s.timeline_markers.clear();s.frame_start=1;s.frame_end=96;s.render.use_sequencer=False;s['production_approved']=False;s['status']='V021_REUSABLE_MASTERS_DEVELOPMENT'
 bpy.ops.file.pack_all();path=out/registry['master_file'];bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
 with path.open('rb') as f:os.fsync(f.fileno())
 sha=digest(path)
 for asset in list(registry['characters'].values())+list(registry['locations'].values()):asset['asset_sha256']=sha
 atomic_json(out/'asset_registry_V021.json',registry);atomic_json(out/'animation_catalog_V021.json',{'version':'V021','clips':CATALOG,'character_action_count':sum(len(x['actions']) for x in registry['characters'].values()),'artist_approved':False})
 print('MASTER_REGISTRY_SAVED',sha,flush=True)

if __name__=='__main__':
 source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);main(source.resolve(),out.resolve())
