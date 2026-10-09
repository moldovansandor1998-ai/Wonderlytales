"""Native Szélkert interaction set: three bellows/bells, matching symbols, guarded bridges.
Mechanism motion is keyed to the exact sound cues; character acting remains separate work.
"""
import bpy,sys,math,json,hashlib
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v016'
bpy.ops.wm.open_mainfile(filepath=str(root/'environment-stage-v015/S1E1_SZELKERT_SKY_V015_DRAFT.blend'));s=bpy.context.scene
# Move the uploaded temple into the establishing background, keeping its source design.
body=max((o for o in s.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));points=[body.matrix_world@Vector(p) for p in body.bound_box];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));matrix=body.matrix_world.copy();body.parent=None;body.matrix_world=matrix
scale=8/(hi.z-lo.z);body.scale*=scale;body.location-=Vector(((lo.x+hi.x)*.5,(lo.y+hi.y)*.5,lo.z))*scale;body.location+=Vector((0,12,-.7))
for o in list(s.objects):
 if o.name.startswith('Cloud_'):bpy.data.objects.remove(o,do_unlink=True)
for o in list(s.objects):
 if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
def mat(name,c,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=.5;b.inputs['Metallic'].default_value=metal;return m
gold=mat('Garden warm brass',(.66,.36,.07),.65);green=mat('Soft leaf green',(.22,.47,.11));stone=mat('Island warm ivory rock',(.47,.41,.30));leather=mat('Bellows amber leather',(.32,.15,.05));rope=mat('Bridge warm woven railing',(.52,.37,.17));aqua=mat('Air pipe turquoise',(.12,.52,.57),.18)
ink=mat('Readable symbol dark teal',(.025,.12,.13))
def mesh(name,verts,faces,material):
 d=bpy.data.meshes.new(name);d.from_pydata(verts,[],faces);d.materials.append(material);o=bpy.data.objects.new(name,d);s.collection.objects.link(o);return o
def box(name,loc,size,material):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;o.data.materials.append(material);b=o.modifiers.new('Soft edges','BEVEL');b.width=.08;b.segments=3;o.modifiers.new('Garden normals','WEIGHTED_NORMAL');return o
def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
def curve(name,points,radius,material):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=radius;d.bevel_resolution=3;sp=d.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 d.materials.append(material);o=bpy.data.objects.new(name,d);s.collection.objects.link(o);return o
for i,(x,y,r) in enumerate([(0,0,3.6),(0,6,2.5),(5.5,6,2.2)]):
 sphere(f'Floating island rock {i}',(x,y,-1.02),(r,r*.82,1),stone);sphere(f'Island grass {i}',(x,y,-.02),(r,r*.82,.10),green)
# Low bellows, with circle / two dots / wave directly visible on their foreplate.
bellcontrols=[];bellows=[]
for i,(x,size,label) in enumerate([(-1.2,.44,'LOW_CIRCLE'),(0,.27,'HIGH_TWO_DOTS'),(1.2,.35,'MIDDLE_WAVE')]):
 box('Bellows base '+label,(x,0,.15),(.72,.87,.12),gold);fold=sphere('Leather folds '+label,(x,0,.26),(.32,.4,.18),leather);top=sphere('Leaf pedal '+label,(x,0,.39),(.36,.48,.08),green);bellows.append((fold,top))
 box('Symbol plaque '+label,(x,-.49,.24),(.46,.05,.28),gold)
 if i==0:curve('Circle symbol',[(x+.09*math.cos(k*math.pi/18),-.52,.24+.09*math.sin(k*math.pi/18)) for k in range(37)],.012,ink)
 if i==1:
  for dx in [-.075,.075]:sphere('Two dots symbol',(x+dx,-.52,.24),(.028,.015,.028),ink)
 if i==2:curve('Wave symbol',[(x-.16+k*.02,-.52,.24+.045*math.sin(k*.65)) for k in range(17)],.013,ink)
 curve('Air pipe '+label,[(x,.25,.25),(x,.9,.25),(x,1.35,.8),(x,1.35,2.7),(x,1.8,3.1)],.045,aqua)
 pivot=bpy.data.objects.new('Bell pivot '+label,None);s.collection.objects.link(pivot);pivot.location=(x,1.8,3.15)
 verts=[];segments=40;rings=[(0,.07),(-.1,size*.45),(-.28,size*.70),(-.5,size),(-.56,size*1.1)]
 for z,r in rings:
  for k in range(segments):a=2*math.pi*k/segments;verts.append((r*math.cos(a),r*math.sin(a),z))
 faces=[]
 for j in range(len(rings)-1):
  for k in range(segments):a=j*segments+k;b=j*segments+(k+1)%segments;faces.append((a,b,b+segments,a+segments))
 o=mesh('Brass bell '+label,verts,faces,gold);o.parent=pivot;o.modifiers.new('Bell wall thickness','SOLIDIFY').thickness=.024
 for p in o.data.polygons:p.use_smooth=True
 clapper=sphere('Bell clapper '+label,(0,0,-.42),(size*.17,)*3,gold);clapper.parent=pivot;bellcontrols.append(pivot)
box('Bell tower crossbeam',(0,1.8,3.25),(3.5,.28,.25),gold)
for x in [-1.9,1.9]:box('Bell tower support',(x,1.8,1.53),(.20,.20,3.1),stone)
# Bridge 1 is present; bridge 2 can only form after the correct sequence.
plates=[]
for j in range(7):
 y=2.6+j*.38;o=box('First stable bridge plank',(0,y,.015),(1.5,.33,.13),gold)
for x in [-.72,.72]:curve('First bridge guardrail',[(x,y,.80) for y in [2.4,3,4,5.2]],.045,rope)
for x in [-.72,.72]:
 for y in [2.6,3.36,4.12,4.88]:box('First bridge railing post',(x,y,.43),(.065,.065,.74),rope)
for j in range(7):
 x=1.95+j*.42;o=box('Second bridge light stone '+str(j),(x,6,-.015),(.37,1.4,.13),gold);plates.append(o)
for y in [5.3,6.7]:curve('Second bridge guardrail',[(x,y,.80) for x in [1.9,3,4,4.8]],.045,rope)
for y in [5.3,6.7]:
 for x in [1.95,2.79,3.63,4.47]:box('Second bridge railing post',(x,y,.43),(.065,.065,.74),rope)
# Mechanical slot, recovered disk and a separate wind vane latch are authored objects.
slot=box('Leaf-shaped disk housing',(2.1,.7,.24),(.8,.5,.22),aqua)
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.19,depth=.035,location=(2.1,.41,.3),rotation=(math.pi/2,0,0));disk=bpy.context.object;disk.name='Recoverable brass circle disk';disk.data.materials.append(gold)
vane=box('Wind vane leaf panel',(5.5,6,.65),(1.3,.2,.95),green);vane['role']='independent_latched_wind_vane';latch=box('Wind vane safety latch',(5,5.85,.63),(.22,.12,.12),gold)
# Key the mechanical motions to the actual bell sounds in the current edit.
cues=json.loads((out/'sound_cues_V016.json').read_text());timeline=json.loads((out/'S1E1_timeline_V016.json').read_text());s.frame_start=1;s.frame_end=timeline['total_frames'];s.render.fps=24
for pivot,(fold,top) in zip(bellcontrols,bellows):pivot.rotation_mode='XYZ';pivot.rotation_euler=(0,0,0);pivot.keyframe_insert('rotation_euler',frame=1);top.keyframe_insert('location',frame=1)
for c in cues:
 if c['type']!='SFX' or c.get('name') not in ['low','high','middle']:continue
 i=['low','high','middle'].index(c['name']);f=round(c['start_sec']*24)+1;pivot=bellcontrols[i];top=bellows[i][1];base=top.location.copy()
 for offset,r in [(-1,0),(3,.16),(8,-.11),(15,.08),(25,0)]:pivot.rotation_euler.x=r;pivot.keyframe_insert('rotation_euler',frame=f+offset)
 for offset,z in [(-5,.39),(0,.27),(5,.28),(15,.39)]:top.location.z=z;top.keyframe_insert('location',frame=f+offset)
 top.location=base
success=next(b for b in timeline['beats'] if b.get('direction_hu','').startswith('Az első fénykő felemelkedik.'))['start_frame']
vane_ready=next(b for b in timeline['beats'] if b.get('direction_hu','').startswith('Mind megállnak. Lili kikotorja'))['start_frame']
for f,r in [(1,0),(vane_ready+70,0),(vane_ready+130,-1.1),(s.frame_end,-1.1)]:vane.rotation_euler.x=r;vane.keyframe_insert('rotation_euler',frame=f)
for i,o in enumerate(plates):
 for f,z in [(1,-.40),(success+i*12,-.40),(success+i*12+24,.015),(s.frame_end,.015)]:o.location.z=z;o.keyframe_insert('location',frame=f)
# Clouds are real geometry in the same lighting, with a readable child-safe horizon.
cloud=mat('Garden cloud white',(.94,.98,1))
for i,(x,y,z) in enumerate([(-7,4,-1),(8,3,-1),(-6,14,3),(8,13,4),(-3,-6,-2),(6,-8,-2)]):
 for j,(dx,rr) in enumerate([(-1,.9),(0,1.3),(1.4,1.0)]):sphere(f'Garden cloud {i} {j}',(x+dx,y,z), (rr*1.5,rr,rr*.65),cloud)
def light(name,loc,energy,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,1,1))-o.location).to_track_quat('-Z','Y').to_euler()
light('Garden soft warm key',(-4,-5,8),1500,7);light('Garden sky fill',(5,-2,5),650,6)
cam=s.camera;cam.data.type='PERSP';cam.data.lens=36;cam.location=(8,-10,7);cam.rotation_euler=(Vector((.5,3,1))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.resolution_x=1280;s.render.resolution_y=720;s.cycles.samples=16;s.cycles.use_denoising=True
s['asset_status']='NATIVE_BELL_GARDEN_MECHANISM_BLOCKING_V016';s['bridges_and_bells_authored']=True;s['mechanism_timed_to_sound']=True;s['character_acting_complete']=False;s['episode_finished']=False;s.frame_set(success+180)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_BELL_GARDEN_MECHANISM_V016.blend'),compress=True);s.render.filepath=str(out/'bell_garden_review_V016.png');bpy.ops.render.render(write_still=True)
(out/'bell_garden_QC_V016.json').write_text(json.dumps({'sound_cues_sha256':hashlib.sha256((out/'sound_cues_V016.json').read_bytes()).hexdigest(),'timeline_sha256':hashlib.sha256((out/'S1E1_timeline_V016.json').read_bytes()).hexdigest(),'three_bells':True,'symbol_order':['circle','two_dots','wave'],'pitch_order':['low','high','middle'],'two_guarded_bridges':True,'mechanism_timed_to_sound':True,'character_acting_complete':False,'episode_finished':False},indent=2))
