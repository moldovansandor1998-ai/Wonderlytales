"""Native SC003 blocking: cloth, visible pickup, joint attention and carrying.
IK and mesh deformation remain review candidates until the poses are inspected.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v017'
source=out/'S1E1_SC001_NATIVE_ACTING_V017.blend';bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;s.frame_set(1600)
mark=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_MARK' in o.name);lili=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_LILI' in o.name);mp=mark.parent;lp=lili.parent;mb=mp.location.copy();lb=lp.location.copy()
for o in s.objects:
 if o.animation_data:o.animation_data.action=None
 if o.type=='LIGHT' and o.data.animation_data:o.data.animation_data.action=None
for rig in [mark,lili]:
 for b in rig.pose.bones:
  if b.name!='jaw':b.rotation_euler=(0,0,0)
 for prop in ['mouth_open','mouth_round','smile','brow_raise']:rig[prop]=0.
for mat in bpy.data.materials:
 if mat.node_tree and mat.node_tree.animation_data:mat.node_tree.animation_data.action=None
s.frame_start=1961;s.frame_end=3602;s.timeline_markers.clear();s.camera.animation_data.action=None;s.camera.data.type='PERSP';s.render.use_sequencer=False
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def pulse(t,a,b,fade=.5):return smooth((t-a)/fade)*smooth((b-t)/fade)
def frame(t):return 1+round(t*24)
def empty(name,pos):o=bpy.data.objects.new(name,None);s.collection.objects.link(o);o.location=pos;o.empty_display_size=.08;return o
def mat(name,c):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.8;return m
# Imported glTF joint display tails are not anatomical IK endpoints. Retarget
# tails to child-joint heads while preserving every joint head and rest mesh.
bpy.ops.object.select_all(action='DESELECT');mark.select_set(True);bpy.context.view_layer.objects.active=mark;bpy.ops.object.mode_set(mode='EDIT')
for side in ['L','R']:
 for parent,child in [('upper_arm','forearm'),('forearm','hand'),('thigh','shin'),('shin','foot')]:mark.data.edit_bones[parent+'.'+side].tail=mark.data.edit_bones[child+'.'+side].head
 hand=mark.data.edit_bones['hand.'+side];hand.tail=hand.head+Vector((0,0,-.060))
 foot=mark.data.edit_bones['foot.'+side];foot.tail=foot.head+Vector((0,-.090,-.055))
bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
if s.sequence_editor:
 for strip in s.sequence_editor.strips:
  if strip.type=='SOUND':strip.frame_final_end=3603
# Fixed ankle goals keep the soles at the existing forest-ground placement.
feet=[]
for side,sign in [('L',1),('R',-1)]:
 bone=mark.data.bones['shin.'+side];target=empty('SC003 ankle goal '+side,mark.matrix_world@bone.tail_local);pole=empty('SC003 knee guide '+side,mb+Vector((sign*.16,-.65,.30)));ik=mark.pose.bones[bone.name].constraints.new('IK');ik.name='SC003 planted foot IK';ik.target=target;ik.pole_target=pole;ik.chain_count=2;ik.use_stretch=False;ik.pole_angle=math.pi/2;feet.append(target)
 target.rotation_euler=(mark.matrix_world@mark.data.bones['foot.'+side].matrix_local).to_euler();rot=mark.pose.bones['foot.'+side].constraints.new('COPY_ROTATION');rot.target=target;rot.owner_space='WORLD';rot.target_space='WORLD'
 arm=mark.pose.bones['forearm.'+side];goal=empty('SC003 cloth wrist goal '+side,mark.matrix_world@arm.bone.tail_local);ik=arm.constraints.new('IK');ik.name='SC003 cloth reach';ik.target=goal;ik.chain_count=2;ik.use_stretch=False
 goal.rotation_euler=(mark.matrix_world@mark.data.bones['hand.'+side].matrix_local).to_euler();rot=mark.pose.bones['hand.'+side].constraints.new('COPY_ROTATION');rot.target=goal;rot.owner_space='WORLD';rot.target_space='WORLD'
 if side=='L':left_goal=goal
 else:right_goal=goal
# A folded cloth emerges from the backpack and opens beneath the fragment.
verts=[];faces=[];N=9
for y in range(N):
 for x in range(N):u=(x/(N-1)-.5)*.26;v=(y/(N-1)-.5)*.19;verts.append((u,v,.008*math.cos(u*35)*math.sin(v*26)+.030*(abs(u)/.13)**4))
for y in range(N-1):
 for x in range(N-1):i=y*N+x;faces.append((i,i+1,i+N+1,i+N))
mesh=bpy.data.meshes.new('Visible cloth woven form');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat('Cloth warm ivory',(.67,.57,.38)));cloth=bpy.data.objects.new('SC003 folded cloth and hand support',mesh);s.collection.objects.link(cloth);sol=cloth.modifiers.new('Cloth slight thickness','SOLIDIFY');sol.thickness=.002
cloth.shape_key_add(name='Basis');fold=cloth.shape_key_add(name='CoverCorner')
for v in fold.data:
 if v.co.x>0:
  f=v.co.x/.13;v.co.x*=1-1.7*f;v.co.z+=.045*math.sin(math.pi*f)+.045*f
shard=bpy.data.objects['Story star fragment under the stone'];initial=shard.location.copy();dot=bpy.data.objects['Small travelling signal'];dot.hide_render=True;glow=bpy.data.objects['Moving signal'];bs=shard.data.materials[0].node_tree.nodes['Principled BSDF'];strength=bs.inputs['Emission Strength']
speech=json.loads((out/'speech_motion_V017.json').read_text())
applied=0
for record in speech['records']:
 if record['scene']!='S1E1_SC003':continue
 rig=mark if record['character']=='CHAR_MARK' else lili;applied+=1
 for prop,keys in [('mouth_open',record['open_keys']),('mouth_round',record['round_keys'])]:
  for f,v in keys:rig[prop]=v;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f+1)
for f in range(1961,3604,2):
 t=(f-1)/24;crouch=smooth((t-81.8)/2.3)*(1-smooth((t-98.0)/3.5));lift=smooth((t-97.46)/4.5);walk=smooth((t-145.3)/1.0)
 mp.location=mb+Vector((.10*pulse(t,133,139),-(t-145.3)*.10*walk,-.49*crouch));mp.rotation_euler.z=-.28*pulse(t,107.12,111.12,.8)
 for path in ['location','rotation_euler']:mp.keyframe_insert(path,frame=f)
 mp.update_tag();bpy.context.view_layer.update()
 carry=mp.location+Vector((0,-.20, .93));floor=Vector((.20,.69,.035));unfold=smooth((t-82)/4.0)
 if t<87.0:cloth.location=(mp.location+Vector((.20,.18,1.10))).lerp(floor,unfold)
 else:cloth.location=floor.lerp(carry,lift)
 fold.value=smooth((t-145.08)/1.8);fold.keyframe_insert('value',frame=f)
 cloth.scale=(.22+.78*unfold,)*3;cloth.rotation_euler=(.03*math.sin(t),0,mp.rotation_euler.z*.8);cloth.keyframe_insert('location',frame=f);cloth.keyframe_insert('scale',frame=f);cloth.keyframe_insert('rotation_euler',frame=f)
 pickup=smooth((t-97.46)/1.0);shard.location=initial.lerp(cloth.location+Vector((0,0,.035)),pickup);shard.rotation_euler=(.5+lift*.65,0,.25+mp.rotation_euler.z);shard.keyframe_insert('location',frame=f);shard.keyframe_insert('rotation_euler',frame=f)
 for goal,sign in [(left_goal,1),(right_goal,-1)]:
  rest=mp.location+Vector((sign*.31,0,.74));reach=cloth.location+Vector((sign*.12,-.015,.13));weight=pulse(t,82.5,150.2,1.2);goal.location=rest.lerp(reach,weight);goal.keyframe_insert('location',frame=f)
 for b in mark.pose.bones:
  if b.name=='jaw':continue
  b.rotation_euler=(0,0,0)
  if b.name=='spine':b.rotation_euler.x=.70*crouch
  if b.name=='chest':b.rotation_euler.x=.08*crouch
  if b.name=='head':b.rotation_euler.x=.11*crouch;b.rotation_euler.z=.10*math.sin(t*.6)
  b.keyframe_insert('rotation_euler',frame=f)
 circle=pulse(t,107.12,111.12,.4);angle=(t-107.12)*1.0
 lp.location=lb.lerp(mb+Vector((math.cos(angle)*1.0,math.sin(angle)*.75+.3,0)),circle);lp.location.y-=(t-145.3)*.10*walk;lp.keyframe_insert('location',frame=f)
 for b in lili.pose.bones:
  if b.name=='jaw':continue
  b.rotation_euler=(0,0,0)
  if b.name=='head':b.rotation_euler.z=.08*math.sin(t*.6);b.rotation_euler.x=.04*math.sin(t*1.0)
  if b.name.startswith('foreleg.') or b.name.startswith('hindleg.'):b.rotation_euler.x=.14*math.sin(t*8+(math.pi if b.name.endswith('R') else 0))*max(circle,walk)
  if b.name.startswith('tail'):b.rotation_euler.z=.12*math.sin(t*3)
  b.keyframe_insert('rotation_euler',frame=f)
 bright=1.4+1.7*smooth((t-112)/2)-1.0*circle;strength.default_value=bright;strength.keyframe_insert('default_value',frame=f);glow.location=shard.location;glow.data.energy=20+15*bright;glow.keyframe_insert('location',frame=f);glow.data.keyframe_insert('energy',frame=f)
 for rig in [mark,lili]:rig['smile']=.22;rig.keyframe_insert(data_path='["smile"]',frame=f)
shots=[('Preparing the cloth',81.6667,97.4583,(-2.3,-2.7,1.0),(-.8,1,.60),43),('Visible two-handed pickup',97.4583,104.4583,(1,-1.0,.65),(.10,.70,.42),54),('Following the direction',104.4583,123.79,(-2.3,-2.8,1.55),(-.8,.8,.95),43),('Inspecting the broken edge',123.79,127.79,(.45,-.6,1.12),(-.15,.65,.96),66),('Checking with Lili',127.79,145.08,(-2.4,-2.4,1.55),(-.8,.85,.88),44),('Leaving together',145.08,150.083,(2,-3.3,1.8),(-.85,.8,.85),40)]
for name,a,b,pos,target,lens in shots:
 data=bpy.data.cameras.new(name);cam=bpy.data.objects.new(name,data);s.collection.objects.link(cam);data.lens=lens;cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();m=s.timeline_markers.new(name,frame=frame(a));m.camera=cam
 if name=='Visible two-handed pickup':
  for sec,cp,ct in [(97.4583,(1,-1,.65),(.10,.70,.42)),(99,(1,-1,.72),(.10,.70,.48)),(102.2,(.70,-1,1.28),(-.15,.65,.94)),(104.4583,(.70,-1,1.32),(-.15,.65,.98))]:
   cam.location=cp;cam.rotation_euler=(Vector(ct)-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=frame(sec));cam.keyframe_insert('rotation_euler',frame=frame(sec))
 if a==81.6667:s.camera=cam
s['status']='SC003_PICKUP_IK_BLOCKING_REVIEW_V017';s['full_episode_finished']=False;s['pose_approved']=False
s.frame_set(1961);bpy.ops.file.pack_all();dest=out/'S1E1_SC003_FRAGMENT_PICKUP_BLOCKING_V017.blend';bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
qc={'scene':'S1E1_SC003','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'speech_tracks_applied':applied,'cloth_and_fragment_native':True,'planted_ankle_IK_goals':2,'hand_IK_goals':2,'visible_pickup_authored':True,'pose_approved':False,'full_episode_finished':False}
(out/'SC003_native_QC_V017.json').write_text(json.dumps(qc,indent=2))
for sec in [85,99,105,125,146]:s.frame_set(frame(sec));s.render.filepath=str(out/f'SC003_review_{sec:03}.png');bpy.ops.render.render(write_still=True)
print('SC003_BLOCKING_SAVED',flush=True)
