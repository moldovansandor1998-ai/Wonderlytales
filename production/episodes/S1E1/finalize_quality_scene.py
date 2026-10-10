"""Visible speaker framing, gate light, and deterministic gravity/contact VFX.

Adds a measured physics development test; it does not approve character contacts.
"""
import bpy,sys,math,json,random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=Path(sys.argv[sys.argv.index('--')+1]);out=root/'episode-v018';source=out/'CSODAKAPU_60S_NATIVE_V018.blend'
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
cam=bpy.data.objects.get('S1E1_SC005_B007')
if cam:
 s.frame_set(980)
 body=next(o for o in s.objects if 'CHAR_ZIZI' in o.name and 'MOUTH_CAVITY' in o.name)
 ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());target=sum((ev.matrix_world@Vector(v) for v in ev.bound_box),Vector())/8+Vector((0,0,.065))
 cam.animation_data_clear();cam.data.lens=52
 for frame,dx in [(947,0),(1038,.055)]:
  cam.location=target+Vector((1.25+dx,-1.55,.22));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert(data_path='location',frame=frame);cam.keyframe_insert(data_path='rotation_euler',frame=frame)
portal=bpy.data.objects['Forest gate light opening'];portal.animation_data_clear()
for frame,size in [(1,.001),(1191,.001),(1203,.28),(1225,.76),(1241,1),(1440,1)]:
 portal.scale=(.98*size,size,1.1*size);portal.keyframe_insert(data_path='scale',frame=frame)
for k in portal.animation_data.action.fcurves:
 for point in k.keyframe_points:point.interpolation='BEZIER'
def material(name,color,strength=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.8;bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=strength;return m
gold=material('Quality test native golden gate sparks',(.9,.5,.05),2);rock=material('Quality test displaced gate stone',(.25,.30,.27))
random.seed(1860)
for index in range(24):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);o=bpy.context.object;o.name=f'QUALITY_TEST gate spark {index:02}';o.data.materials.append(gold)
 angle=index*math.tau/24
 for frame in [1,1185,1195,1210,1225,1240,1255,1280,1300]:
  u=max(0,min(1,(frame-1195)/85));a=angle+u*math.tau*.6;radius=.2+u*.88
  o.location=(math.cos(a)*radius,5.82-.35*u,1.13+math.sin(a)*radius*1.12);size=.015*math.sin(math.pi*u) if 1195<frame<1280 else .00001;o.scale=(size,)*3
  o.keyframe_insert(data_path='location',frame=frame);o.keyframe_insert(data_path='scale',frame=frame)
light=bpy.data.lights.new('QUALITY_TEST gate reflected light','POINT');light.color=(.08,.85,1);light.shadow_soft_size=.8;o=bpy.data.objects.new(light.name,light);s.collection.objects.link(o);o.location=(0,5.7,1.2)
for frame,energy in [(1,0),(1191,0),(1206,420),(1225,180),(1241,300),(1440,180)]:light.energy=energy;light.keyframe_insert(data_path='energy',frame=frame)
floor=bpy.data.objects['V018 continuous woodland terrain'];tree=BVHTree.FromPolygons([floor.matrix_world@v.co for v in floor.data.vertices],[p.vertices[:] for p in floor.data.polygons])
impacts=[]
for index,x in enumerate([-.87,.87]):
 y=5.82;hit,_,_,_=tree.ray_cast(Vector((x,y,3)),Vector((0,0,-1)),6);ground=hit.z if hit else 0;radius=.04
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);o=bpy.context.object;o.name=f'QUALITY_TEST gravity gate chip {index}';o.data.materials.append(rock);o.scale=(.028,.024,radius);o.location=(x,y,1.7-index*.15);o.keyframe_insert(data_path='location',frame=1);o.keyframe_insert(data_path='location',frame=1191)
 z=o.location.z;velocity=0;settled=False
 for frame in range(1192,1441):
  for substep in range(4):
   if settled:continue
   velocity-=9.81/96;z+=velocity/96
   if z-radius<ground:
    z=ground+radius
    if abs(velocity)>.3:impacts.append({'object':o.name,'frame':frame,'time_sec':(frame-1)/24,'speed_m_s':abs(velocity),'floor_z':ground})
    velocity=-velocity*.22
    if velocity<.18:settled=True;velocity=0
  o.location.z=z;o.keyframe_insert(data_path='location',frame=frame)
  o.rotation_euler=(.06*math.sin((frame-1191)*.25),.08*math.cos((frame-1191)*.2),0);o.keyframe_insert(data_path='rotation_euler',frame=frame)
 for fc in o.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
 o['physics']='gravity 9.81 m/s2; 96 Hz substeps; native terrain contact; restitution .22'
s.frame_set(1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
contacts=[]
for control in s.objects:
 if '_V018_PLANT_' not in control.name or not control.animation_data:continue
 action=control.animation_data.action;curves=[action.fcurves.find('location',index=i) for i in range(3)]
 if not all(curves):continue
 frames=list(range(1,337,2));points=[Vector([fc.evaluate(frame) for fc in curves]) for frame in frames]
 for i in range(1,len(points)-1):
  if (points[i+1]-points[i]).length<.00002 and points[i-1].z-points[i].z>.004:
   contacts.append({'character':control.name.split('_V018_PLANT_')[0],'foot':control.name.split('_V018_PLANT_')[1],'frame':frames[i],'time_sec':(frames[i]-1)/24,'position_m':list(points[i])})
(out/'quality_test_foot_contacts_V018.json').write_text(json.dumps({'method':'authored foot target landing into stationary stance; visual sole validation pending','events':sorted(contacts,key=lambda c:c['frame'])},indent=2))
(out/'quality_test_physics_V018.json').write_text(json.dumps({'integrator':'semi-implicit Euler','substeps_per_frame':4,'gravity_m_s2':9.81,'restitution':.22,'native_floor_mesh':floor.name,'impacts':impacts,'full_character_collision_approved':False},indent=2))
print('QUALITY_SCENE_FRAMING_AND_CONTACT_SAVED',flush=True)
