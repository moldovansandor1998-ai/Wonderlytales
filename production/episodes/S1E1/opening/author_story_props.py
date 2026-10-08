"""Reusable native story props: broken star, scarf, basket, rolling meter.
Blender --python this.py -- OUTPUT. New prop designs remain director drafts.
"""
import bpy,math,sys,json
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene
def mat(name,c,rough=.45,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
wicker=mat('Warm woven willow',(.32,.12,.035));wood=mat('Honey wood',(.28,.095,.022));brass=mat('Soft brass',(.48,.27,.055),.28,.7);rubber=mat('Soft dark wheels',(.027,.029,.024),.65);cloth=mat('Scarf moss green',(.10,.27,.18),.82);teal=mat('Star glass',(.025,.47,.57),.17)
bs=teal.node_tree.nodes.get('Principled BSDF');bs.inputs['Transmission Weight'].default_value=.25;bs.inputs['Emission Color'].default_value=(.025,.5,.65,1);bs.inputs['Emission Strength'].default_value=.5
cream=mat('Warm gauge face',(.74,.65,.40),.6);red=mat('Pointer red',(.40,.035,.015),.45)
def root(name,x):
 o=bpy.data.objects.new(name,None);s.collection.objects.link(o);o.location=(x,0,0);o['status']='PROP_DESIGN_DRAFT';return o
def attach(o,r):o.parent=r;return o
def tube(name,pts,radius,material,parent):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2
 spline=c.splines.new('POLY');spline.points.add(len(pts)-1)
 for p,co in zip(spline.points,pts):p.co=(*co,1)
 c.materials.append(material);o=bpy.data.objects.new(name,c);s.collection.objects.link(o);return attach(o,parent)
def box(name,loc,size,material,parent,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.location=loc;o.scale=size;o.data.materials.append(material)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 b=o.modifiers.new('Rounded handmade edges','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return attach(o,parent)
def cylinder(name,loc,radius,depth,material,parent):
 bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=radius,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(material)
 b=o.modifiers.new('Rounded rim','BEVEL');b.width=.004;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return attach(o,parent)
# Broken fifth point identifies the shard rather than an anonymous light ball.
star=root('PROP_STAR_SHARD',-.95);vertices=[]
outline=[]
for i in range(10):
 a=math.pi/2+2*math.pi*i/10;r=.08 if i%2==0 else .035
 if i==0:
  outline.extend([(.009,.048),(-.009,.048)]);continue
 outline.append((r*math.cos(a),r*math.sin(a)))
for z in [.005,.025]:vertices.extend([(x,y,z) for x,y in outline])
n=len(outline)
faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
mesh=bpy.data.meshes.new('Broken five point star');mesh.from_pydata(vertices,[],faces);mesh.materials.append(teal);o=bpy.data.objects.new('Glass star shard',mesh);s.collection.objects.link(o);attach(o,star)
b=o.modifiers.new('Safe worn edges','BEVEL');b.width=.003;b.segments=3;o.modifiers.new('Star normals','WEIGHTED_NORMAL')
star.rotation_euler.x=.25;star.scale=(2,2,2)
# Folded cloth has actual surface thickness and soft undulations.
scarf=root('PROP_FOLDED_SCARF',-.35);verts=[];faces=[];n=25
for j in range(n):
 for i in range(n):
  x=(i/(n-1)-.5)*.34;y=(j/(n-1)-.5)*.23
  z=.016+.011*math.sin(i*.42)*math.cos(j*.22)+.01*math.exp(-((y-.02)/.05)**2)
  verts.append((x,y,z))
for j in range(n-1):
 for i in range(n-1):a=j*n+i;faces.append((a,a+1,a+n+1,a+n))
mesh=bpy.data.meshes.new('Folded cloth surface');mesh.from_pydata(verts,[],faces);mesh.materials.append(cloth)
o=bpy.data.objects.new('Folded scarf',mesh);s.collection.objects.link(o);attach(o,scarf)
for p in mesh.polygons:p.use_smooth=True
o.modifiers.new('Cloth thickness','SOLIDIFY').thickness=.001;o.modifiers.new('Soft cloth','SUBSURF').levels=1
for side in [-1,1]:
 for i in range(20):
  x=-.16+i*.016;tube('Scarf fringe',[(x,side*.115,.016),(x+.004,side*.138,.012)],.0012,cloth,scarf)
# Basket weave consists of crossing willow strips, with a separate carry handle.
basket=root('PROP_MORZSI_BASKET',.28)
for k in range(9):
 z=.025+k*.019;radius=.105+.032*z/.2
 pts=[(radius*math.cos(a*2*math.pi/80),radius*math.sin(a*2*math.pi/80)*.78,z+.0018*math.sin(a*2*math.pi/80*24)) for a in range(81)]
 tube('Horizontal willow weave',pts,.004,wicker,basket)
for k in range(32):
 a=k*2*math.pi/32;pts=[]
 for j in range(22):
  z=.016+j*.0085;r=.105+.032*z/.2+.002*math.sin(j*math.pi/2+k*math.pi)
  pts.append((r*math.cos(a),r*.78*math.sin(a),z))
 tube('Vertical willow weave',pts,.0037,wicker,basket)
cylinder('Basket base',(0,0,.017),.105,.018,wicker,basket).scale.y=.78
pts=[(.14*math.cos(a*math.pi/48),0,.19+.19*math.sin(a*math.pi/48)) for a in range(49)]
tube('Basket carrying handle',pts,.008,wicker,basket)
lid=bpy.data.objects.new('PROP_BASKET_REMOVABLE_LID',None);s.collection.objects.link(lid);lid.parent=basket;lid.location=(0,0,.195)
lid['animation_role']='independent_removable_lid'
cylinder('Woven basket lid',(0,0,0),.137,.004,wicker,lid).scale.y=.78
for k in range(1,9):
 r=k*.015;pts=[(r*math.cos(a*2*math.pi/72),r*.78*math.sin(a*2*math.pi/72),.004) for a in range(73)]
 tube('Lid willow ring',pts,.0022,wicker,lid)
for k in range(16):
 a=k*2*math.pi/16;tube('Lid radial weave',[(0,0,.004),(.132*math.cos(a),.132*.78*math.sin(a),.004)],.0019,wicker,lid)
# Zizi's little rolling meter: functional wheel and pointer object hierarchy.
meter=root('PROP_ZIZI_ROLLING_METER',.95)
box('Meter wooden cart',(0,0,.075),(.30,.22,.07),wood,meter,.015)
for x in [-.10,.10]:
 for y in [-.13,.13]:
  wheel=cylinder('Meter wheel',(x,y,.055),.053,.021,rubber,meter);wheel.rotation_euler.x=math.pi/2
  cylinder('Brass axle cap',(x,y*1.08,.055),.016,.026,brass,meter).rotation_euler.x=math.pi/2
tube('Bent brass handle',[(-.13,.08,.105),(-.13,.1,.30),(.13,.1,.30),(.13,.08,.105)],.006,brass,meter)
gauge=cylinder('Meter brass case',(0,-.018,.23),.079,.045,brass,meter);gauge.rotation_euler.x=math.pi/2
face=cylinder('Meter dial',(0,-.047,.23),.071,.003,cream,meter);face.rotation_euler.x=math.pi/2
for i in range(12):
 a=2*math.pi*i/12
 tube('Meter dial tick',[(.054*math.sin(a),-.052,.23+.054*math.cos(a)),(.062*math.sin(a),-.052,.23+.062*math.cos(a))],.0015,rubber,meter)
pointer_control=bpy.data.objects.new('Meter pointer control',None);s.collection.objects.link(pointer_control);pointer_control.parent=meter;pointer_control.location=(0,-.056,.23)
pointer_control['animation_role']='rotate_local_y_about_dial_center'
pointer=box('Meter pointer',(0,0,.022),(.007,.005,.059),red,pointer_control,.001)
for k in range(16):
 a=k*2*math.pi/16
 tube('Copper coil segment',[(.10+.018*math.cos(a),.04,.115+.018*math.sin(a)),(.10+.018*math.cos(a+.4),.08,.115+.018*math.sin(a+.4))],.003,brass,meter)

floor=mat('Studio ground',(.065,.10,.10),.8);box('Studio floor',(0,0,-.025),(3.0,1.5,.03),floor,None,.01)
def light(name,loc,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.1))-o.location).to_track_quat('-Z','Y').to_euler()
light('Soft key',(-1,-1.4,2.4),170,(1,.80,.62),2);light('Cool fill',(1,-.5,1.3),55,(.60,.80,1),1.5);light('Rim',(0,1.2,1.5),110,(1,.65,.35),1)
s.world=bpy.data.worlds.new('Studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.06,.09,.12,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.3
cam=bpy.data.objects.new('Props camera',bpy.data.cameras.new('Props camera'));s.collection.objects.link(cam);cam.location=(0,-2.9,1.6);cam.rotation_euler=(Vector((0,0,.13))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.65;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100
s['status']='STORY_PROP_DESIGNS_DRAFT';s['production_approved']=False
bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_STORY_PROPS_V001_DRAFT.blend'),compress=True)
s.render.filepath=str(out/'Wonderly_Tales_S1E1_kellekek_V001_DRAFT.png');bpy.ops.render.render(write_still=True)
(out/'props_manifest.json').write_text(json.dumps({'props':['PROP_STAR_SHARD','PROP_FOLDED_SCARF','PROP_MORZSI_BASKET','PROP_ZIZI_ROLLING_METER'],'native_geometry':True,'production_approved':False,'independent_basket_lid':True,'dial_pointer_pivot_created':True,'cloth_simulation_created':False},indent=2))
print('STORY_PROPS_CREATED',flush=True)
