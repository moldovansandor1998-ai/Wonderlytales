"""Reusable native forest and Wondergate look-development set.

blender -b --python build_forest_set.py -- OUTPUT_DIRECTORY
Uses authored geometry and procedural materials; no external textures required.
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector, Euler

out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(4815);scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Forest atmosphere');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.28,.35,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35

def material(name,color,roughness=.8,noise_scale=5,bump=.1):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links
    bs=n.get('Principled BSDF');bs.inputs['Roughness'].default_value=roughness
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=noise_scale
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(v*.6 for v in color)+(1,)
    ramp.color_ramp.elements[1].color=color+(1,);l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs[0],bs.inputs['Base Color'])
    bn=n.new('ShaderNodeBump');bn.inputs['Strength'].default_value=bump;bn.inputs['Distance'].default_value=.08
    l.new(tex.outputs['Fac'],bn.inputs['Height']);l.new(bn.outputs['Normal'],bs.inputs['Normal'])
    return m
bark=material('Oak bark',(.25,.13,.065),noise_scale=18,bump=.45)
earth=material('Forest earth',(.17,.12,.07),noise_scale=8,bump=.25)
pathmat=material('Ochre footpath',(.39,.26,.14),noise_scale=12,bump=.17)
stone=material('Ancient gate sandstone',(.37,.42,.38),noise_scale=9,bump=.015)
moss=material('Velvet moss',(.15,.27,.065),noise_scale=25,bump=.25)
greens=[material('Leaf green '+str(i),c,noise_scale=3,bump=.06) for i,c in enumerate([(.19,.34,.055),(.33,.46,.08),(.085,.22,.025)])]

def mesh(name,verts,faces,mat):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.materials.append(mat)
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o)
    for p in data.polygons:p.use_smooth=True
    return o
def tube(name,points,radii,mat):
    verts=[];faces=[];count=10
    for j,p in enumerate(points):
        direction=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(0,j-1)])
        direction.normalize();a=direction.cross(Vector((0,1,0)))
        if a.length<.1:a=direction.cross(Vector((1,0,0)))
        a.normalize();b=direction.cross(a)
        for k in range(count):verts.append(Vector(p)+radii[j]*(math.cos(k*2*math.pi/count)*a+math.sin(k*2*math.pi/count)*b))
    for j in range(len(points)-1):
        for k in range(count):faces.append((j*count+k,j*count+(k+1)%count,(j+1)*count+(k+1)%count,(j+1)*count+k))
    faces.extend([tuple(reversed(range(count))),tuple((len(points)-1)*count+k for k in range(count))])
    return mesh(name,verts,faces,mat)
def ground(x,y):return .035*math.sin(x*.6)*math.cos(y*.7)+.009*x
verts=[(x,y,ground(x,y)) for y in range(-8,19) for x in range(-14,15)]
faces=[(j*29+i,j*29+i+1,(j+1)*29+i+1,(j+1)*29+i) for j in range(26) for i in range(28)]
mesh('Uneven forest floor',verts,faces,earth)
verts=[]
for j in range(41):
    y=-8+j*.5;center=.6*math.sin(y*.23)
    verts.extend([(center-1.0,y,ground(center-1,y)+.07),(center+1,y,ground(center+1,y)+.07)])
mesh('Winding forest path',verts,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(40)],pathmat)
leafverts=[(0,0,0),(.09,.055,.012),(.22,0,0),(.09,-.055,.012),(.095,0,.035)]
leaffaces=[(0,1,4),(1,2,4),(2,3,4),(3,0,4)]
leaf_batches=[([],[]) for _ in greens]
def leaf_at(p,scale,angle,variant=0):
    verts,faces=leaf_batches[variant];base=len(verts)
    rotation=Euler((random.uniform(-.6,.6),random.uniform(-.6,.6),angle)).to_matrix()
    verts.extend(Vector(p)+rotation@(Vector(v)*scale) for v in leafverts)
    faces.extend(tuple(base+k for k in f) for f in leaffaces)
for tree in range(25):
    x=random.uniform(-11,11);y=random.uniform(-2,16)
    if abs(x)<2.4: x+=3 if x>=0 else -3
    height=random.uniform(5,8);r=random.uniform(.25,.55)
    tube('Oak trunk',[(x,y,ground(x,y)),(x+.12,y,.9),(x-.12,y+.1,height*.52),(x+.25,y,height)], [r*1.4,r,r*.68,.06],bark)
    for a in [0,1.6,3.2,4.8]:tube('Oak root',[(x,y,.15),(x+math.cos(a)*r*1.7,y+math.sin(a)*r*1.7,.07),(x+math.cos(a)*r*3,y+math.sin(a)*r*3,.015)],[r*.35,r*.14,.01],bark)
    for branch in range(5):
        a=branch*1.26+random.uniform(-.2,.2);z=height*.6+branch*.35
        tip=Vector((x+math.cos(a)*2,y+math.sin(a)*2,z+1.1))
        tube('Oak branch',[(x,y,z),((x+tip.x)/2,(y+tip.y)/2,z+.5),tip],[r*.32,r*.17,.025],bark)
        for k in range(100):
            p=tip+Vector((random.uniform(-1.3,1.3),random.uniform(-1.3,1.3),random.uniform(-.6,.6)))
            leaf_at(p,random.uniform(1.3,2.5),random.uniform(0,6.28),random.randrange(3))
for i in range(100):
    x=random.uniform(-8,8);y=random.uniform(-4,12)
    if abs(x)<1.6:continue
    for a in range(6):
        angle=a*1.047;length=random.uniform(.35,.7)
        for j in range(1,9):
            u=j/9;cx=x+math.cos(angle)*length*u;cy=y+math.sin(angle)*length*u;z=ground(x,y)+.06+.45*math.sin(u*2)
            for side in [-1,1]:leaf_at((cx,cy,z),(.55-u*.4),angle+side*1.3,2)
for i in range(25):
    x=random.uniform(-8,8);y=random.uniform(-3,13)
    if abs(x)<1.4:continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,.12))
    o=bpy.context.object;o.name='Moss covered boulder';o.scale=(random.uniform(.2,.7),random.uniform(.2,.5),random.uniform(.15,.4));o.data.materials.append(stone)
    for p in o.data.polygons:p.use_smooth=True
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(x,y,.28))
    o=bpy.context.object;o.name='Boulder moss cap';o.scale=(.3,.3,.08);o.data.materials.append(moss)
# A true empty opening supports independently authored portal effects.
for side in [-1,1]:
    for z in [1.7/6,1.7/2,1.7*5/6]:
        bpy.ops.mesh.primitive_cube_add(size=2,location=(side*1.3,6,z));o=bpy.context.object;o.name='Wondergate pillar stone';o.scale=(.28,.38,1.7/6);o.data.materials.append(stone)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        mod=o.modifiers.new('Worn stone edges','BEVEL');mod.width=.035;mod.segments=3
archverts=[];archfaces=[]
for i in range(33):
    a=i*math.pi/32
    for y in [5.62,6.38]:
        for radius in [1.02,1.58]:archverts.append((radius*math.cos(a),y,1.7+radius*math.sin(a)))
for i in range(32):
    k=4*i
    archfaces.extend([(k,k+4,k+5,k+1),(k+2,k+3,k+7,k+6),(k,k+2,k+6,k+4),(k+1,k+5,k+7,k+3)])
archfaces.extend([(0,1,3,2),(128,130,131,129)])
arch=mesh('Continuous ancient stone arch',archverts,archfaces,stone)
for p in arch.data.polygons:p.use_smooth=False
for i in range(50):
    a=random.uniform(0,math.pi);radius=random.uniform(1.05,1.6)
    leaf_at((radius*math.cos(a),5.60,1.7+radius*math.sin(a)),.45,random.uniform(0,6.28),2)
for i,(verts,faces) in enumerate(leaf_batches):
    mesh('Reusable forest foliage '+str(i),verts,faces,greens[i])
# Distant hills give the camera depth behind the empty gate opening.
for x,y,z,scale in [(-9,24,0,(12,8,3)),(9,28,0,(13,10,4)),(0,37,0,(18,10,5))]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1,location=(x,y,z))
    o=bpy.context.object;o.name='Distant wooded hill';o.scale=scale;o.data.materials.append(greens[2])
    for p in o.data.polygons:p.use_smooth=True
sun=bpy.data.lights.new('Late afternoon sun','SUN');sun.energy=2.5;sun.angle=.1
o=bpy.data.objects.new('Late afternoon sun',sun);scene.collection.objects.link(o);o.rotation_euler=(.6,-.6,-.5)
data=bpy.data.lights.new('Soft camera fill','AREA');data.energy=700;data.size=7
o=bpy.data.objects.new('Soft camera fill',data);scene.collection.objects.link(o);o.location=(-3,-3,6);o.rotation_euler=(Vector((0,4,1))-o.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Forest establishing camera');cam=bpy.data.objects.new('Forest establishing camera',camdata);scene.collection.objects.link(cam)
cam.location=(4,-7,2.4);cam.rotation_euler=(Vector((0,5,1.45))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=34;scene.camera=cam
scene['asset_status']='FOREST_LOOKDEV_DRAFT';scene['episode_finished']=False
bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_FOREST_WONDERGATE_V002_DRAFT.blend'),compress=True)
scene.render.filepath=str(out/'S1E1_forest_review.png');bpy.ops.render.render(write_still=True)
(out/'forest_QC.json').write_text(json.dumps({'blender':bpy.app.version_string,'objects':len(scene.objects),'source':'AUTHORED_NATIVE_GEOMETRY','external_files_required':False,'status':'LOOKDEV_DRAFT','final_approved':False},indent=2))
