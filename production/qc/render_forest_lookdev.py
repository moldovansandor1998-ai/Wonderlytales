"""Actual native characters in a reusable draft forest lighting scene.

Blender --python this.py -- assets.json output_directory
One rendered still; not an animated shot or production-approved environment.
"""
import bpy, bmesh, json, math, random, sys
from pathlib import Path
from mathutils import Vector
random.seed(1742)
args=sys.argv[sys.argv.index('--')+1:]
assets=json.loads(Path(args[0]).read_text())
out=Path(args[1]); out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=96
scene.cycles.use_adaptive_sampling=True; scene.cycles.adaptive_threshold=.025
scene.cycles.use_denoising=True; scene.cycles.device='CPU'
scene.render.resolution_x=1920; scene.render.resolution_y=1080
scene.render.resolution_percentage=100; scene.render.fps=24
scene.world=bpy.data.worlds.new('Forest sky'); scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.34,.48,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.25

def material(name,color,noise_scale=6,bump=.08):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nodes=m.node_tree.nodes; links=m.node_tree.links
    bs=nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=.76
    n=nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=noise_scale
    n.inputs['Detail'].default_value=4
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=tuple(x*.5 for x in color)+(1,)
    ramp.color_ramp.elements[1].color=tuple(color)+(1,)
    links.new(n.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],bs.inputs['Base Color'])
    b=nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value=bump
    links.new(n.outputs['Fac'],b.inputs['Height']); links.new(b.outputs[0],bs.inputs['Normal'])
    return m
stone=material('Weathered sandstone',(.32,.37,.33),12,.22)
earth=material('Forest floor',(.19,.135,.07),28,.3)
bark=material('Bark',(.12,.075,.032),15,.45)
moss=material('Moss',(.12,.23,.035),45,.3)
leaves=[material('Leaves '+str(i),c,8,.04) for i,c in enumerate([(.18,.31,.06),(.3,.38,.065),(.09,.21,.045)])]

ico_meshes={}
def ico(name,loc,scale,mat,sub=2):
    key=(mat.name,sub)
    if key not in ico_meshes:
        mesh=bpy.data.meshes.new(name+' geometry'); bm=bmesh.new()
        bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=1)
        bm.to_mesh(mesh); bm.free(); mesh.materials.append(mat)
        for p in mesh.polygons:p.use_smooth=True
        ico_meshes[key]=mesh
    o=bpy.data.objects.new(name,ico_meshes[key]); scene.collection.objects.link(o)
    o.location=loc; o.scale=scale
    return o
def box(name,loc,scale,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(mat)
    bevel=o.modifiers.new('Worn corners','BEVEL'); bevel.width=.065; bevel.segments=3
    o.modifiers.new('Stone normals','WEIGHTED_NORMAL')
    return o

# Character meshes retain their source geometry and texture identity.
for code,x,y,height,angle in [('CHAR_MARK',-.67,0,1.6,.12),('CHAR_LILI',.58,-.05,1.0,-.2)]:
    asset=next(a for a in assets if a['character']==code)
    with bpy.data.libraries.load(asset['blend'],link=False) as (src,dst):dst.objects=list(src.objects)
    objects=[o for o in dst.objects if o and (o.type=='ARMATURE' or (o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)))]
    for o in objects:scene.collection.objects.link(o)
    rig=next(o for o in objects if o.type=='ARMATURE'); rig.animation_data_clear()
    for b in rig.pose.bones:b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0)
    bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    lo=Vector(tuple(min(p[k] for p in corners) for k in range(3)))
    hi=Vector(tuple(max(p[k] for p in corners) for k in range(3)))
    scale=height/(hi.z-lo.z)
    pivot=bpy.data.objects.new(code+'_placement',None); scene.collection.objects.link(pivot)
    for o in objects:
        if o.parent not in objects:o.parent=pivot
    pivot.scale=(scale,)*3; pivot.location=(x-(lo.x+hi.x)*scale/2,y-(lo.y+hi.y)*scale/2,-lo.z*scale)
    pivot.rotation_euler.z=angle
    rig.pose.bones['head'].rotation_euler.y=.06 if code=='CHAR_MARK' else -.05

bpy.ops.mesh.primitive_grid_add(x_subdivisions=70,y_subdivisions=70,size=32)
ground=bpy.context.object; ground.name='Forest ground'; ground.data.materials.append(earth)
for v in ground.data.vertices:v.co.z=.014*math.sin(v.co.x*3.1)*math.cos(v.co.y*4.3)-.02

# Built masonry, retaining the gate opening rather than a flat backdrop.
gx,gy=1.15,2.55
for side in [-1,1]:
    for z in range(5):
        box('Gate pier',(gx+side*1.25,gy,.22+z*.42),(.65,.6,.4),stone)
for i in range(13):
    t=math.pi*i/12
    o=box('Arch voussoir',(gx+1.25*math.cos(t),gy,1.92+1.25*math.sin(t)),(.37,.62,.57),stone)
    o.rotation_euler.y=math.pi/2-t
for i in range(65):
    t=random.uniform(0,math.pi)
    ico('Gate moss',(gx+1.4*math.cos(t),gy-.32,1.92+1.4*math.sin(t)),(.15,.065,.075),moss,1)
glow=bpy.data.materials.new('Turquoise rune'); glow.use_nodes=True
bs=glow.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(.025,.6,.7,1)
bs.inputs['Emission Color'].default_value=(.01,.8,1,1); bs.inputs['Emission Strength'].default_value=3
for z in [.5,1,1.5]:
    for side in [-1,1]:box('Rune',(gx+side*1.25,gy-.315,z),(.05,.015,.15),glow)

# Layered trees and individually modeled leaves; no character proxies.
for i in range(22):
    x=random.uniform(-8,8); y=random.uniform(3.3,13)
    if abs(x-gx)<1.6 and y<4.3:continue
    h=random.uniform(4,7); r=random.uniform(.18,.4)
    bpy.ops.mesh.primitive_cone_add(vertices=14,radius1=r,radius2=r*.65,depth=h,location=(x,y,h/2))
    tree=bpy.context.object; tree.name='Tree'; tree.data.materials.append(bark)
    for j in range(12):
        center=Vector((x+random.uniform(-1.7,1.7),y+random.uniform(-1.2,1.2),h+random.uniform(-.7,1.1)))
        for k in range(9):
            p=center+Vector((random.uniform(-.5,.5),random.uniform(-.5,.5),random.uniform(-.2,.2)))
            o=ico('Canopy leaf',p,(.2,.08,.018),random.choice(leaves),1)
            o.rotation_euler=(random.uniform(-.6,.6),random.uniform(-.5,.5),random.uniform(0,6.28))
for i in range(340):
    x=random.uniform(-5,5); y=random.uniform(-3,5)
    if abs(x)<1.3 and -.7<y<1.4:continue
    for j in range(3):
        o=ico('Understory leaf',(x+random.uniform(-.1,.1),y+random.uniform(-.1,.1),random.uniform(.04,.18)),(.15,.04,.012),random.choice(leaves),1)
        o.rotation_euler=(0,random.uniform(-.9,.9),random.uniform(0,6.28))
for i in range(30):
    x=random.uniform(-4,4); y=random.uniform(.5,7)
    if abs(x)<1 and y<1:continue
    ico('Rock',(x,y,0),(.2,.3,.12),stone)

def area(name,loc,target,color,power,size):
    l=bpy.data.lights.new(name,'AREA'); l.energy=power; l.color=color; l.shape='DISK'; l.size=size
    o=bpy.data.objects.new(name,l); scene.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Warm canopy key',(-3,-1,5),(0,0,.7),(1,.72,.38),750,3)
area('Golden rim',(1,2,4),(0,0,1),(1,.68,.25),1050,2)
area('Sky fill',(0,-4,3),(0,0,.8),(.46,.65,1),160,4)
area('Portal bounce',(1,2,2),(0,0,1),(.1,.8,1),120,2)
cam=bpy.data.objects.new('Film camera',bpy.data.cameras.new('Film camera')); scene.collection.objects.link(cam)
cam.location=(2.1,-5.8,2.1); target=Vector((0,.6,1.05))
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=46; cam.data.dof.use_dof=True; cam.data.dof.focus_distance=(Vector((0,0,.9))-cam.location).length; cam.data.dof.aperture_fstop=3.2
scene.camera=cam
scene.use_nodes=True; nodes=scene.node_tree.nodes; nodes.clear()
r=nodes.new('CompositorNodeRLayers'); glare=nodes.new('CompositorNodeGlare'); glare.glare_type='FOG_GLOW'; glare.quality='HIGH'; glare.threshold=2
c=nodes.new('CompositorNodeComposite'); scene.node_tree.links.new(r.outputs['Image'],glare.inputs['Image']); scene.node_tree.links.new(glare.outputs['Image'],c.inputs['Image'])
scene['status']='DRAFT_NATIVE_FOREST_LOOKDEV'; scene['production_approved']=False; scene['facial_ready']=False
bpy.ops.file.pack_all(); bpy.ops.wm.save_as_mainfile(filepath=str((out/'forest_lookdev_DRAFT.blend').resolve()),compress=True)
scene.render.filepath=str((out/'Wonderly_Tales_erdei_fenyproba_DRAFT.png').resolve()); bpy.ops.render.render(write_still=True)
