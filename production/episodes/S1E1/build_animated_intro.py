"""Native 3D cast opening: four animated cameras, skeletal poses, travelling light and 3D title."""
import bpy,sys,math,json,time
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v016';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'cast-stage-v015/S1E1_SIX_CHARACTERS_V015_DRAFT.blend'))
s=bpy.context.scene;s.frame_start=1;s.frame_end=360;s.render.fps=24
s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100
s.cycles.samples=8;s.cycles.use_denoising=True;s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2;s.cycles.transmission_bounces=3
s.render.image_settings.file_format='PNG';s.render.film_transparent=False
for o in bpy.data.objects:
 o.animation_data_clear()
 if o.type=='ARMATURE':
  for b in o.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
# Modest, individual gestures keep feet grounded; no facial readiness is implied.
rigs=[o for o in bpy.data.objects if o.type=='ARMATURE']
for ri,rig in enumerate(rigs):
 for f in range(1,361,6):
  sec=(f-1)/24;phase=ri*.9
  for b in rig.pose.bones:
   rot=[0.,0.,0.]
   if b.name=='head':rot=[.035*math.sin(sec*1.7+phase),.018*math.sin(sec*1.1+phase),.11*math.sin(sec*.8+phase)]
   if b.name in ('chest','spine'):rot[0]=.018*math.sin(sec*2+phase)
   if b.name.startswith('tail'):rot[0]=.14*math.sin(sec*5+phase);rot[2]=.18*math.sin(sec*3+phase)
   if b.name.startswith('ear_') or b.name.startswith('ear.'):
    rot[0]=.10*math.sin(sec*2+phase);rot[2]=.06*math.sin(sec*3+phase)
   if b.name=='forearm.R' and 'MARK' in rig.name:rot[0]=.10+.20*math.sin(sec*1.3)
   if b.name=='forearm.L' and 'ZIZI' in rig.name:rot[0]=.14+.18*math.sin(sec*2)
   if b.name=='forearm.R' and 'POTTY' in rig.name:rot[0]=.10+.12*math.sin(sec*1.8)
   if b.name=='forearm.R' and 'MORZSI' in rig.name:rot[0]=.10+.12*math.sin(sec*1.1)
   b.rotation_euler=rot;b.keyframe_insert('rotation_euler',frame=f)
  if f==355:
   for b in rig.pose.bones:b.keyframe_insert('rotation_euler',frame=360)
# Warm turquoise travelling spark, not a replacement for the story prop.
mat=bpy.data.materials.new('Intro turquoise star glow');mat.use_nodes=True
nodes=mat.node_tree.nodes;nodes.clear();em=nodes.new('ShaderNodeEmission');em.inputs['Color'].default_value=(.03,.7,1,1);em.inputs['Strength'].default_value=3;output=nodes.new('ShaderNodeOutputMaterial');mat.node_tree.links.new(em.outputs[0],output.inputs['Surface'])
verts=[]
for z in (-.04,.04):
 for i in range(10):
  a=i*math.pi/5+math.pi/2;r=.17 if i%2==0 else .078;verts.append((math.cos(a)*r,0+z,math.sin(a)*r))
faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
mesh=bpy.data.meshes.new('Animated five-point light mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat);spark=bpy.data.objects.new('Opening travelling star light',mesh);s.collection.objects.link(spark)
positions=[(1,(-.9,.1,1.65)),(54,(-.2,.4,2.05)),(84,(.5,.6,1.75)),(85,(1.1,.6,1.4)),(144,(2.1,.8,2.1)),(145,(.15,.05,1.1)),(216,(2.7,1,1.4)),(217,(-2,.1,2.5)),(282,(.2,.2,2.8)),(320,(1.7,.2,2.65)),(360,(.2,.2,2.8))]
for f,p in positions:spark.location=p;spark.rotation_euler=(0,f*.03,f*.018);spark.keyframe_insert('location',frame=f);spark.keyframe_insert('rotation_euler',frame=f)
# Camera cuts and within-shot dollies, all captured from native geometry.
s.timeline_markers.clear()
shots=[('Mark and Lili',1,84,(-3,-4,2.05),(-2.25,-3.6,1.9),(-.9,.9,1.05),48),('Morzsi and Bogyó',85,144,(2.7,-3.1,1.9),(2.1,-2.6,1.6),(1,1.1,1),42),('Pötty and Zizi',145,216,(3.7,-3.7,1.85),(3,-3.1,1.8),(1.6,1.1,.95),45),('Csodakapu cast title',217,360,(3.8,-7.3,3.2),(2.8,-6.6,3.0),(.5,1.2,1.5),37)]
for name,start,end,a,b,target,lens in shots:
 data=bpy.data.cameras.new(name);cam=bpy.data.objects.new(name,data);s.collection.objects.link(cam);data.lens=lens;data.clip_end=100
 for f,pos in [(start,a),(end,b)]:
  cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f)
 marker=s.timeline_markers.new(name,frame=start);marker.camera=cam
 if start==1:s.camera=cam
# Actual extruded 3D title, sitting above cast and lit in the same scene.
gold=bpy.data.materials.new('Title honey gold');gold.diffuse_color=(1,.65,.04,1);gold.use_nodes=True;bs=gold.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,.61,.015,1);bs.inputs['Metallic'].default_value=.25;bs.inputs['Roughness'].default_value=.35
for name,body,size,z in [('Csodakapu title','CSODAKAPU',.50,2.8),('WonderlyTales subtitle','WONDERLYTALES',.19,2.45)]:
 data=bpy.data.curves.new(name,'FONT');data.body=body;data.align_x='CENTER';data.size=size;data.extrude=.02;data.bevel_depth=.006;data.materials.append(gold);o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=(.5,.1,z);o.rotation_euler=(math.pi/2,0,0)
 for f,scale in [(1,0),(216,0),(217,.001),(242,1),(360,1)]:o.scale=(scale,)*3;o.keyframe_insert('scale',frame=f)
s['asset_status']='ANIMATED_3D_OPENING_REVIEW_V016';s['facial_ready']=False;s['full_episode_finished']=False
bpy.ops.file.pack_all();s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_NATIVE_ANIMATED_INTRO_V016.blend'),compress=True)
for frame in [42,115,175,300]:
 s.frame_set(frame);s.render.filepath=str(out/f'intro_review_{frame:04}.png');t=time.time();bpy.ops.render.render(write_still=True);print('REVIEW_FRAME',frame,round(time.time()-t,2),flush=True)
(out/'intro_native_QC.json').write_text(json.dumps({'fps':24,'duration_sec':15,'native_camera_shots':4,'animated_armatures':len(rigs),'render_size':[960,540],'facial_ready':False,'full_episode_finished':False},indent=2))
