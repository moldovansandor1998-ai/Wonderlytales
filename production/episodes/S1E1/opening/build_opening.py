"""Fixed native characters, reusable forest, 15s intro and first HU exchange.
Blender --python build_opening.py -- ROOT OUTPUT
This is animation blocking and look development, not the finished episode.
"""
import bpy, math, random, sys, json, hashlib
from pathlib import Path
from mathutils import Vector

root,out=map(Path,sys.argv[sys.argv.index('--')+1:]);root=root.resolve();out=out.resolve()
random.seed(4815)
bpy.ops.wm.open_mainfile(filepath=str(root/'episode-assets/forest_lookdev_DRAFT.blend'))
s=bpy.context.scene
# Replace all old Mark descendants, including the native body, with V013.
old=bpy.data.objects['CHAR_MARK_placement']
def descendants(o):
 return [o]+[d for c in o.children for d in descendants(c)]
for o in reversed(descendants(old)):bpy.data.objects.remove(o,do_unlink=True)
def append_character(path,code,position,height):
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):
  dst.objects=[n for n in src.objects]
 loaded=[o for o in dst.objects if o]
 rig=next(o for o in loaded if o.type=='ARMATURE')
 def belongs(o):
  p=o
  while p:
   if p==rig:return True
   p=p.parent
  return o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)
 # Source libraries also contain unlinked test geometry. Import the native
 # rig hierarchy, not every mesh datablock retained in the source file.
 objects=[o for o in loaded if belongs(o)]
 for o in objects:s.collection.objects.link(o)
 if rig.animation_data:rig.animation_data.action=None
 for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
 for k in ['jaw_open','blink','smile','brow_raise','mouth_round','mouth_spread','gaze_yaw','gaze_pitch']:
  if k in rig:rig[k]=0
 bpy.context.view_layer.update()
 body=max((o for o in objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
 corners=[body.matrix_world@Vector(c) for c in body.bound_box];lo=min(v.z for v in corners);hi=max(v.z for v in corners)
 pivot=bpy.data.objects.new(code+'_film_placement',None);s.collection.objects.link(pivot)
 for o in objects:
  if o.parent not in objects:
   matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
 scale=height/(hi-lo);pivot.scale=(scale,)*3;pivot.location=(*position,-lo*scale)
 rig.name=code+'_FILM_DRAFT';body.name=code+'_NATIVE_BODY'
 return rig,body,pivot,objects
mark,markbody,mp,markobjects=append_character(root/'mark-film-lookdev-v013/CHAR_MARK_FILM_LOOKDEV_V013_DRAFT.blend','CHAR_MARK',(-.6,0),1.6)
lili=next(o for o in s.objects if o.type=='ARMATURE' and 'LILI' in o.name)
lili.animation_data_clear();lp=lili.parent
lb=next(o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==lili for m in o.modifiers))
for b in lili.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
support=[('CHAR_LILI',lili,lb,lp,[lili,lb,lp])]
for code,pos,height in [('CHAR_MORZSI',(-1.8,1.1),1.25),('CHAR_POTTY',(-1.2,-.35),.95),('CHAR_BOGYO',(.0,1.7),.8),('CHAR_ZIZI',(1.1,1.35),1.1)]:
 rig,body,pivot,objects=append_character(root/f'episode-assets/{code}_V008_BLENDER_BODY_DRAFT.blend',code,pos,height)
 support.append((code,rig,body,pivot,objects+[pivot]))

# Shader changes preserve native geometry and textures. No disconnected-seam
# smoothing, topology replacement or character regeneration.
quality=[]
for code,rig,body,pivot,objects in support:
 for i,mat in enumerate(body.data.materials):
  mat=mat.copy();mat.name=code+'_FILM_MATERIAL_DRAFT';body.data.materials[i]=mat
  if mat.use_nodes:
   bs=mat.node_tree.nodes.get('Principled BSDF')
   if bs:
    for link in list(mat.node_tree.links):
     if link.to_node==bs and link.to_socket.name in ['Roughness','Metallic']:mat.node_tree.links.remove(link)
    bs.inputs['Roughness'].default_value=.67;bs.inputs['Metallic'].default_value=0
    # Fur is an opaque fiber surface; random-walk SSS leaked through the
    # native draft shell and produced bright artifacts. Keep it disabled.
    bs.inputs['Subsurface Weight'].default_value=0
 for p in body.data.polygons:p.use_smooth=True
 quality.append({'character':code,'native_vertices':len(body.data.vertices),'bones':len(rig.pose.bones),'material_pass':True,'facial_ready':False,'production_approved':False})

# Real fern fronds and a leafy canopy replace the sparse schematic understory.
for o in list(s.objects):
 if o.name.startswith('Understory leaf'):bpy.data.objects.remove(o,do_unlink=True)
leafmat=bpy.data.materials['Leaves 0']
leafmesh=bpy.data.meshes.new('Curved fern leaflet')
leafmesh.from_pydata([(0,0,0),(.12,.026,.014),(.25,0,.01),(.12,-.026,.014),(.12,0,.03)],[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)])
leafmesh.materials.append(leafmat)
for p in leafmesh.polygons:p.use_smooth=True
fern_vertices=[];fern_faces=[]
for i in range(42):
 x=random.uniform(-5,5);y=random.uniform(-2,8)
 if abs(x)<1.1 and -.5<y<1:continue
 for frond in range(5):
  a=2*math.pi*frond/5+random.uniform(-.25,.25);length=random.uniform(.4,.8)
  for j in range(1,10):
   u=j/10;center=Vector((x+math.cos(a)*length*u,y+math.sin(a)*length*u,.10+.45*math.sin(u*math.pi*.65)))
   for side in [-1,1]:
    angle=a+side*1.1;scale=.35+.65*(1-u);base=len(fern_vertices)
    for v in leafmesh.vertices:
     q=v.co*scale;fern_vertices.append(center+Vector((q.x*math.cos(angle)-q.y*math.sin(angle),q.x*math.sin(angle)+q.y*math.cos(angle),q.z)))
    fern_faces.extend([tuple(base+k for k in p.vertices) for p in leafmesh.polygons])
mesh=bpy.data.meshes.new('Fern frond geometry');mesh.from_pydata(fern_vertices,[],fern_faces);mesh.materials.append(leafmat)
fern=bpy.data.objects.new('Detailed reusable ferns',mesh);s.collection.objects.link(fern)
for p in mesh.polygons:p.use_smooth=True
canopy_material=bpy.data.materials['Leaves 2']
for i in range(85):
 x=random.uniform(-9,9);y=random.uniform(3,12);z=random.uniform(4,7)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,z))
 o=bpy.context.object;o.name='Layered leafy canopy';o.scale=(random.uniform(.7,1.7),random.uniform(.6,1.4),random.uniform(.4,.8));o.data.materials.append(canopy_material)
 for p in o.data.polygons:p.use_smooth=True
# Soften the crude masonry with small distributed moss patches.
for i in range(55):
 a=random.uniform(0,math.pi);r=1.31+random.uniform(-.1,.1)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(1.15+r*math.cos(a),2.20,1.92+r*math.sin(a)))
 o=bpy.context.object;o.name='Fine gate moss';o.scale=(.07,.02,.04);o.data.materials.append(bpy.data.materials['Moss'])
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.18,.23,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.35
for o in s.objects:
 if o.type=='LIGHT':o.data.energy*=.75
s.view_settings.exposure=-.2

# A fixed shard and floating leaf anchor the story action in actual geometry.
glow=bpy.data.materials['Turquoise rune']
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.035,location=(-.12,-.5,.13))
shard=bpy.context.object;shard.name='Story star shard';shard.data.materials.append(glow)
prop_source=root/'episode-story-props-v001/S1E1_STORY_PROPS_V001_DRAFT.blend'
if prop_source.exists():
 with bpy.data.libraries.load(str(prop_source),link=False) as (src,dst):dst.objects=['Glass star shard']
 shard.data=dst.objects[0].data.copy();shard.data.materials.clear();shard.data.materials.append(glow)
 shard.scale=(.5,.5,.5);shard.rotation_euler=(.20,.15,.3)
 b=shard.modifiers.new('Worn shard edge','BEVEL');b.width=.002;b.segments=3
 shard.modifiers.new('Shard normals','WEIGHTED_NORMAL')
 s['star_shape']='BROKEN_FIVE_POINT_NATIVE_PROP'
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(-.12,-.5,.065))
story_rock=bpy.context.object;story_rock.name='Story shard resting stone';story_rock.scale=(.12,.14,.055);story_rock.data.materials.append(bpy.data.materials['Weathered sandstone'])
for f in [1,360,361,600]:story_rock.hide_render=f<361;story_rock.keyframe_insert('hide_render',frame=f)
floating=bpy.data.objects.new('Story floating leaf',leafmesh);s.collection.objects.link(floating);floating.location=(-.10,-.45,.13)
for frame in [1,360,361,552,560,600]:
 floating.location.z=.13 if frame<=560 else .28+.03*math.sin(frame*.07)
 floating.rotation_euler.z=.15 if frame<=560 else (frame-560)*.008
 floating.keyframe_insert('location',frame=frame);floating.keyframe_insert('rotation_euler',frame=frame)

schedule=json.loads((out/'dialogue_schedule.json').read_text());fps=24;end=int(schedule['duration_sec']*fps)
for frame in [1,560,561,end]:
 shard.hide_render=frame<561;shard.keyframe_insert('hide_render',frame=frame)
# The gate appears in the brand intro, but is discovered later in the story.
# Keep it out of scene one's forest location to preserve continuity.
for o in s.objects:
 if o.name.startswith(('Gate pier','Arch voussoir','Gate moss','Rune','Fine gate moss')):
  for frame in [1,360,361,end]:
   o.hide_render=frame>=361;o.keyframe_insert('hide_render',frame=frame)
cam=s.camera;cam.data.dof.use_dof=False;cam.data.lens=42
def camera(frame,location,target,lens):
 cam.location=location;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=lens
 cam.keyframe_insert('location',frame=frame);cam.keyframe_insert('rotation_euler',frame=frame);cam.data.keyframe_insert('lens',frame=frame)
camera(1,(1.15,-4.9,2.35),(1.15,2.5,1.6),44)
camera(96,(1.15,-4.3,2.2),(1.15,2.5,1.6),44)
camera(97,(.2,-5.9,2.25),(-.15,.8,1.0),42)
camera(240,(.2,-5.65,2.15),(-.15,.8,1.0),42)
camera(241,(.2,-5.65,2.15),(-.15,.8,1.0),42)
camera(360,(.2,-5.65,2.15),(-.15,.8,1.0),42)
camera(361,(1.75,-4.4,1.8),(-.10,0,1.0),48)
camera(end,(1.6,-4.2,1.75),(-.10,0,1.0),48)
for datablock in [cam,cam.data]:
 for fc in datablock.animation_data.action.fcurves:
  for k in fc.keyframe_points:k.interpolation='LINEAR'
  for k in fc.keyframe_points:
   if int(k.co.x) in [96,240,360]:k.interpolation='CONSTANT'

# Native rig reactions, subtle breathing, and source-recording amplitude jaw.
for frame in range(1,end+1):
 t=(frame-1)/fps;intro=t<15
 mark['jaw_open']=0.;mark['blink']=0.;mark['smile']=.12
 for line in schedule['dialogue']:
  dt=t-line['start_sec']
  if line['character']=='CHAR_MARK' and 0<=dt<line['duration_sec']:
   index=min(len(line['envelope'])-1,int(dt*24));mark['jaw_open']=.68*line['envelope'][index]
 for blink in [5.2,9.2,16.5,21.8]:mark['blink']=max(mark['blink'],max(0,1-abs(t-blink)/.12))
 for prop in ['jaw_open','blink','smile']:mark.keyframe_insert(data_path='["'+prop+'"]',frame=frame)
 for rig in [mark]+[r for _,r,_,_,_ in support]:
  h=rig.pose.bones['head'];h.rotation_euler.x=.025*math.sin(t*1.5)
  h.rotation_euler.y=.04*math.sin(t*.7)
  h.rotation_euler.z=.07*math.sin(t*.9) if intro else (.035 if rig==mark else -.045)
  h.keyframe_insert('rotation_euler',frame=frame)
  if 'spine' in rig.pose.bones:
   b=rig.pose.bones['spine'];b.rotation_euler.x=.007*math.sin(t*2);b.keyframe_insert('rotation_euler',frame=frame)
  if 'tail_01' in rig.pose.bones:
   b=rig.pose.bones['tail_01'];b.rotation_euler.z=.12*math.sin(t*2);b.keyframe_insert('rotation_euler',frame=frame)
  if 'ear_base.L' in rig.pose.bones:
   for side in ['L','R']:
    b=rig.pose.bones['ear_base.'+side];b.rotation_euler.y=.035*math.sin(t*2);b.keyframe_insert('rotation_euler',frame=frame)
 gesture=max(0,1-abs(t-7.2)/1.2) if intro else 0
 for name,angle in [('upper_arm.R',-.20),('forearm.R',-.45)]:
  b=mark.pose.bones[name];b.rotation_euler.x=angle*gesture;b.keyframe_insert('rotation_euler',frame=frame)
 # Four friends belong only to the intro, not scene one's story.
 for code,rig,body,pivot,objects in support[1:]:
  for o in objects:
   if o.type=='MESH':o.hide_render=not intro or frame<=96;o.keyframe_insert('hide_render',frame=frame)
 for o in markobjects+[lb]:
  if o.type in ['MESH','CURVE']:
   o.hide_render=frame<=96;o.keyframe_insert('hide_render',frame=frame)

# Camera-attached title remains identical across episodes except the number.
title_material=bpy.data.materials.new('Warm intro lettering');title_material.use_nodes=True
bs=title_material.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,.78,.28,1);bs.inputs['Emission Color'].default_value=(1,.68,.16,1);bs.inputs['Emission Strength'].default_value=.5
def text_object(name,text,y,size,start):
 data=bpy.data.curves.new(name,'FONT');data.body=text;data.align_x='CENTER';data.size=size;data.extrude=.0001;data.materials.append(title_material)
 o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.parent=cam;o.location=(0,y,-1.3)
 for f in [1,start-1,start,360,361,end]:
  o.hide_render=f<start or f>360;o.keyframe_insert('hide_render',frame=f)
 return o
text_object('Fixed brand','WONDERLY TALES',.065,.034,241)
text_object('Fixed series title','CSODAKAPU',-.015,.069,241)
text_object('Episode number only','1. rész',-.083,.030,289)

s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True
s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2
s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100
s.render.fps=24;s.frame_start=1;s.frame_end=end;s.render.use_sequencer=False
s.render.image_settings.file_format='PNG';s.render.film_transparent=False
s['status']='S1E1_OPENING_ANIMATION_BLOCKING_V001';s['production_approved']=False
s['intro_duration_frames']=360;s['phoneme_alignment']=False;s['lili_lipsync_ready']=False
s.frame_set(1);out.mkdir(exist_ok=True)
if (out/'opening_mix_DRAFT.wav').exists():
 editor=s.sequence_editor_create()
 audio=editor.strips.new_sound('Opening HU and draft theme',str(out/'opening_mix_DRAFT.wav'),channel=1,frame_start=1)
 audio.sound.pack()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_OPENING_ANIMATION_V001_DRAFT.blend'),compress=True)
bpy.data.libraries.write(str(out/'SUPPORTING_FILM_MATERIALS_V009_DRAFT.blend'),set(o for _,_,_,_,obs in support for o in obs),fake_user=True,compress=True)
(out/'production_manifest.json').write_text(json.dumps({'status':'ANIMATION_BLOCKING_DRAFT','duration_sec':schedule['duration_sec'],'fps':24,'resolution':[1920,1080],'intro_frames':360,'opening_dialogue_count':2,'all_episode_dialogue_count':131,'full_episode_completed':False,'phoneme_alignment':False,'lili_lipsync_ready':False,'characters':quality,'story_actions_completed':False,'quality_gate_passed':False},indent=2))
s.render.filepath=str(out/'opening_first_frame.png');s.frame_set(433)
bpy.ops.render.render(write_still=True)
print('OPENING_BUILT',end,flush=True)
