"""Author SC001 against the approved V016 sound edit.

Native skeletal walking, stopping, listening and reaching; leaf, light and shard
interactions. Facial controls are artist drafts, not certified phoneme alignment.
Blender --background --python build_opening_scene.py -- WORKSPACE
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v017';out.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'cast-stage-v015/S1E1_SIX_CHARACTERS_V015_DRAFT.blend'))
s=bpy.context.scene;s.frame_start=1;s.frame_end=1600;s.render.fps=24
s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100
s.cycles.samples=4;s.cycles.use_denoising=True;s.cycles.max_bounces=3;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2
s.render.use_persistent_data=True;s.render.image_settings.file_format='PNG'
rigs={code:next(o for o in s.objects if o.type=='ARMATURE' and code in o.name) for code in ['CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO']}
bodies={code:max((o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)),key=lambda o:len(o.data.vertices)) for code,rig in rigs.items()}
for o in s.objects:
 o.animation_data_clear()
for rig in rigs.values():
 for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
for code in ['CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO']:bodies[code].hide_render=True
for o in s.objects:
 if any(part in o.name.lower() for part in ['gate arch','portal','gate pillar','gate stone','gate glyph','continuous ancient stone arch']):o.hide_render=True

def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def pulse(t,a,b,fade=.4):return smooth((t-a)/fade)*smooth((b-t)/fade)
def frame(sec):return 1+round(sec*24)
def mat(name,color,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.45
 if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
 return m
dark=mat('Mouth soft warm interior',(.028,.006,.009));lip=mat('Mark soft lip edge',(.33,.115,.065));tongue=mat('Soft tongue pink',(.42,.09,.12))

# Native lip ribbon, weighted jaw and recessed cavity on a preserved source fork.
sys.path.insert(0,str(Path(__file__).parent))
from native_cartoon_face import author_face
profiles={'CHAR_MARK':(-.004,.769,.024,.013),'CHAR_LILI':(-.145,.605,.021,.010),'CHAR_MORZSI':(.006,.708,.028,.015),'CHAR_POTTY':(0,.566,.020,.012),'CHAR_ZIZI':(.026,.674,.025,.012)}
face_report=[author_face(s,bodies[code],rigs[code],code,profile) for code,profile in profiles.items()]
for o in s.objects:
 if o.type=='MESH' and any(m.type=='ARMATURE' and m.object and any(c in m.object.name for c in ['CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO']) for m in o.modifiers):o.hide_render=True

speech=json.loads((out/'speech_motion_V017.json').read_text())
for record in speech['records']:
 if record['scene']!='S1E1_SC001':continue
 rig=rigs[record['character']]
 for prop,keys in [('mouth_open',record['open_keys']),('mouth_round',record['round_keys'])]:
  for f,v in keys:rig[prop]=v;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f+1)

# Different strides, actual travel, stops, leaning and reactions throughout SC001.
mark=rigs['CHAR_MARK'];lili=rigs['CHAR_LILI'];mp=mark.parent;lp=lili.parent
mb=mp.location.copy();lb=lp.location.copy()
for f in range(1,1602,2):
 t=(f-1)/24;walk=1-smooth((t-8.4)/1.3);progress=smooth(t/9.5);phase=t*7.4
 mp.location=mb+Vector((0,2.1*(1-progress),.009*abs(math.sin(phase))*walk))
 lp.location=lb+Vector((.10*math.sin(t*.8)*walk,2.4*(1-smooth(t/10.8)),.008*abs(math.sin(t*8.5+.9))*walk))
 # The boy takes two small steps toward the stone and settles before the warning.
 toward=smooth((t-48.7)/2.0);mp.location.x+=.25*toward;mp.location.y-=.15*toward
 for pivot in [mp,lp]:pivot.keyframe_insert('location',frame=f)
 for code,rig in [('CHAR_MARK',mark),('CHAR_LILI',lili)]:
  is_mark=code=='CHAR_MARK';step=phase if is_mark else t*8.5+.9;weight=walk if is_mark else 1-smooth((t-9.4)/1.2)
  lean=pulse(t,34.3,39.2,1.0) if is_mark else 0
  surprise=pulse(t,20.2,24.2,.45) if is_mark else pulse(t,59.3,61.2,.25)
  for b in rig.pose.bones:
   if b.name=='jaw':continue
   rot=[0.,0.,0.]
   if b.name=='head':rot=[.05*math.sin(t*1.1)+.19*lean,-.02*math.sin(t*.8),(.08 if is_mark else -.07)*math.sin(t*.7)+.14*pulse(t,34,43,1)]
   if b.name in ['spine','chest']:rot[0]=.018*math.sin(t*2.2)+.25*lean
   if b.name.startswith('thigh.'):rot[0]=(.22*math.sin(step+(math.pi if b.name.endswith('R') else 0)))*weight-.17*lean
   if b.name.startswith('shin.'):rot[0]=max(0,math.sin(step+(math.pi if b.name.endswith('R') else 0)))*.25*weight+.23*lean
   if b.name.startswith('upper_arm.'):rot[0]=-.13*math.sin(step+(math.pi if b.name.endswith('R') else 0))*weight
   if b.name=='forearm.R':rot[0]=.1+.25*pulse(t,29.7,32.8)+.30*pulse(t,49,53.2)
   if b.name.startswith('foreleg.'):rot[0]=.16*math.sin(step+(math.pi if b.name.endswith('R') else 0))*weight
   if b.name=='foreleg.L' and not is_mark:rot[0]+=.28*pulse(t,50,57,.7)
   if b.name.startswith('hindleg.'):rot[0]=-.14*math.sin(step+(math.pi if b.name.endswith('R') else 0))*weight
   if b.name.startswith('tail'):rot[2]=.10*math.sin(t*2.5);rot[0]=.07*math.sin(t*3.1)
   b.rotation_euler=rot;b.keyframe_insert('rotation_euler',frame=f)
  rig['brow_raise']=surprise*.75;rig.keyframe_insert(data_path='["brow_raise"]',frame=f)
  rig['smile']=.15+.4*pulse(t,13.7,17.3) if not is_mark else .2+.3*pulse(t,62,64.7)
  rig.keyframe_insert(data_path='["smile"]',frame=f)

# A small leaf and a fragment with an intentionally incomplete, blunt silhouette.
leaf_mat=mat('Hero autumn leaf warm amber',(.62,.23,.018));spark_mat=mat('Story fragment turquoise',(.025,.30,.40),0)
mesh=bpy.data.meshes.new('Detailed hero leaf');mesh.from_pydata([(-.14,0,0),(0,-.045,0),(.14,0,0),(0,.045,0),(0,0,.012)],[],[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]);mesh.materials.append(leaf_mat);leaf=bpy.data.objects.new('Leaf lifted by the signal',mesh);s.collection.objects.link(leaf)
for sec,pos,angle in [(0,(-.12,.78,.035),0),(17.5,(-.12,.78,.035),0),(19.5,(-.12,.78,.035),0),(21.0,(-.12,.78,.26),.5),(22.3,(.11,.89,.36),1.2),(24.45,(.22,.97,.035),1.8),(66.667,(.22,.97,.035),1.8)]:
 leaf.location=pos;leaf.rotation_euler=(.2,angle*.3,angle);leaf.keyframe_insert('location',frame=frame(sec));leaf.keyframe_insert('rotation_euler',frame=frame(sec))
verts=[]
for y in [-.026,.026]:
 for i in range(8):
  a=i*2*math.pi/10+math.pi/2;r=.085 if i%2==0 else .037;verts.append((math.cos(a)*r,y,math.sin(a)*r))
faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
mesh=bpy.data.meshes.new('Incomplete star fragment native mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(spark_mat);shard=bpy.data.objects.new('Story star fragment under the stone',mesh);s.collection.objects.link(shard);shard.location=(.20,.69,.042);shard.scale=(.35,)*3;shard.rotation_euler=(.5,0,.25)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=(.28,.75,.095));stone=bpy.context.object;stone.name='Flat stone hiding the fragment';stone.scale=(.30,.16,.026);stone.data.materials.append(mat('Flat warm stone',(.24,.22,.17)))
light_data=bpy.data.lights.new('Story signal light','POINT');light_data.color=(.03,.8,1);light_data.shadow_soft_size=.12;glow=bpy.data.objects.new('Moving signal',light_data);s.collection.objects.link(glow)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.018);dot=bpy.context.object;dot.name='Small travelling signal';dot.data.materials.append(spark_mat)
for f in range(1,1602,2):
 t=(f-1)/24
 if t<24.5:pos=Vector((-.14+(t-19)*.13,.75,.08));power=40*pulse(t,19.5,24.3,.25)
 elif t<43.5:
  pos=Vector((.2+math.sin(t*1.1)*.48,1.30+math.cos(t*1.1)*.30,.12));power=35*sum(pulse(t,a,a+.45,.11) for a in [34.0,35.3,37.1,39.1,40.3,41.5])
 else:pos=Vector(shard.location);power=35*smooth((t-48.8)/1.7)+12*math.sin(t*2)**2
 shard_strength=spark_mat.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'];shard_strength.default_value=.6+1.8*smooth((t-49)/5);shard_strength.keyframe_insert('default_value',frame=f)
 glow.location=pos;light_data.energy=power;glow.keyframe_insert('location',frame=f);light_data.keyframe_insert('energy',frame=f)
 dot.location=pos;dot.scale=(max(.001,min(1,power/30)),)*3;dot.keyframe_insert('location',frame=f);dot.keyframe_insert('scale',frame=f)

# Purposeful cuts: walking, two-shot dialogue, leaf, reaction, listening and reveal.
s.timeline_markers.clear()
shots=[('Walking on the leaf path',0,10,(-2.8,-2.8,2.05),(-2.6,-2.8,1.95),(-.8,1.9,.9),40),('Mark speaks',10,13.667,(-1.25,-1.5,1.55),(-1.2,-1.45,1.55),(-.4,1,1.35),55),('Lili answers',13.667,17.46,(-2.35,-1.1,.86),(-2.3,-1.05,.86),(-1.64,1,.66),55),('Leaf lifts under the step',17.46,22.2,(.65,-.08,.29),(.54,-.01,.29),(0,.82,.10),48),('Surprised friends',22.2,33.42,(-2.6,-2.6,1.6),(-2.4,-2.4,1.6),(-.9,1.0,.83),39),('Listening for the light',33.42,43.42,(-2.3,-2.7,1.7),(-1.8,-2.65,1.6),(-.85,1.15,.85),44),('Lili stops Mark',43.42,57.04,(-2.8,-2.7,1.55),(-2.55,-2.5,1.5),(-.9,.95,.83),39),('The fragment under the stone',57.04,59.5,(.43,.28,.17),(.40,.34,.15),(.20,.69,.042),65),('Lili discovers the fragment',59.5,60.95,(-2.35,-1.1,.86),(-2.3,-1.05,.86),(-1.64,1,.66),55),('The fragment revealed',60.95,62.04,(.43,.28,.17),(.40,.34,.15),(.20,.69,.042),65),('Mark understands',62.04,64.67,(-.1,-1.1,1.55),(-.13,-1.04,1.54),(-.15,.87,1.28),57),('The fragment rings',64.67,66.667,(.43,.29,.15),(.40,.34,.13),(.20,.69,.042),65)]
for name,a,b,p0,p1,target,lens in shots:
 data=bpy.data.cameras.new(name);cam=bpy.data.objects.new(name,data);s.collection.objects.link(cam);data.lens=lens
 for sec,pos in [(a,p0),(b,p1)]:cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=frame(sec));cam.keyframe_insert('rotation_euler',frame=frame(sec))
 marker=s.timeline_markers.new(name,frame=frame(a));marker.camera=cam
 if a==0:s.camera=cam
s.use_nodes=True;n=s.node_tree.nodes;n.clear();r=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='HIGH';g.threshold=1.;g.size=7;o=n.new('CompositorNodeComposite');s.node_tree.links.new(r.outputs['Image'],g.inputs['Image']);s.node_tree.links.new(g.outputs['Image'],o.inputs['Image'])
s['status']='SC001_NATIVE_ACTING_REVIEW_V017';s['full_episode_finished']=False;s['facial_approved']=False
s.render.use_sequencer=False
se=s.sequence_editor_create();audio=se.strips.new_sound('Approved V016 episode sound',str(root/'WonderlyTales_S1E1_teljes_hangvagas_V016.m4a'),channel=1,frame_start=1);audio.frame_final_end=1601
for snd in bpy.data.sounds:
 if snd.filepath:snd.pack()
bpy.ops.file.pack_all();s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_SC001_NATIVE_ACTING_V017.blend'),compress=True)
qc={'scene':'S1E1_SC001','duration_sec':1600/24,'native_camera_shots':len(shots),'walking_characters':2,'all_dialogue_mouth_tracks':131,'all_reaction_mouth_tracks':12,'applied_SC001_speech_tracks':11,'mouth_method':'audio envelope with word-timed artist rounding','phoneme_alignment_verified':False,'facial_approved':False,'full_episode_finished':False,'face_controls':face_report,'source_timeline_sha256':hashlib.sha256((root/'episode-v016/S1E1_timeline_V016.json').read_bytes()).hexdigest()}
(out/'SC001_native_QC_V017.json').write_text(json.dumps(qc,indent=2))
for sec in [6,11,15,21,26,37,52,59,63]:
 s.frame_set(frame(sec));s.render.filepath=str(out/f'SC001_review_{sec:02}.png');bpy.ops.render.render(write_still=True)
print('SC001_NATIVE_SAVED',flush=True)
