"""Reversible character surface/eye/hair look development; not a final master.
Blender --python this.py -- SOURCE SOURCE_SHA OUTPUT_DIR
Preserves the source mesh, body rig and facial drivers in a separate version.
"""
import bpy, math, random, hashlib, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

source, expected, output = sys.argv[sys.argv.index('--')+1:]
source, output = Path(source).resolve(), Path(output).resolve()
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
assert not output.exists(), 'Preserve previous authoring versions.'
bpy.ops.wm.open_mainfile(filepath=str(source))
s = bpy.context.scene
s.frame_set(1)
rig = next(o for o in s.objects if o.type == 'ARMATURE')
body = bpy.data.objects['geometry_0']
original_vertex_count = len(body.data.vertices)
source_driver_count = len(rig.animation_data.drivers)
base = body.data.materials[0]

def set_input(material, name, value):
    bs = material.node_tree.nodes.get('Principled BSDF')
    for link in list(material.node_tree.links):
        if link.to_node == bs and link.to_socket.name == name:
            material.node_tree.links.remove(link)
    bs.inputs[name].default_value = value

def micro_surface(material, scale, strength, distance):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    tex = nodes.new('ShaderNodeTexNoise'); tex.inputs['Scale'].default_value = scale
    tex.inputs['Detail'].default_value = 2
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    links.new(tex.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])

skin = base.copy(); skin.name = 'V012 skin with small-scale diffusion'
set_input(skin, 'Roughness', .46)
set_input(skin, 'Metallic', 0.)
set_input(skin, 'Subsurface Weight', .12)
set_input(skin, 'Subsurface Scale', .0012)
set_input(skin, 'Subsurface Radius', (1., .45, .25))
micro_surface(skin, 750., .12, .00004)
hair = base.copy(); hair.name = 'V012 brown hair surface'
set_input(hair, 'Roughness', .5)
set_input(hair, 'Metallic', 0.)
set_input(hair, 'Anisotropic', .25)
micro_surface(hair, 420., .18, .00008)
body.data.materials.append(skin); body.data.materials.append(hair)
skin_index, hair_index = len(body.data.materials)-2, len(body.data.materials)-1
atlas = bpy.data.images['Image_0']
pixels = np.empty(len(atlas.pixels), dtype=np.float32)
atlas.pixels.foreach_get(pixels)
pixels = pixels.reshape(atlas.size[1], atlas.size[0], 4)
uvs = body.data.uv_layers.active.data
def color(poly):
    uv = sum((uvs[i].uv for i in poly.loop_indices), Vector((0,0))) / len(poly.loop_indices)
    return pixels[int(np.clip(uv.y,0,1)*(atlas.size[1]-1)), int(np.clip(uv.x,0,1)*(atlas.size[0]-1)), :3]
skin_faces, hair_faces = 0, 0
hair_vertices = set()
for p in body.data.polygons:
    p.use_smooth = True
    c = p.center
    if c.z > .879:
        p.material_index = hair_index; hair_faces += 1; hair_vertices.update(p.vertices)
    elif .712 < c.z < .895 and abs(c.x) < .12 and c.y < .015:
        rgb = color(p)
        if rgb[0] > .35 and rgb[1] > .18 and rgb[0] > rgb[2]*1.35:
            p.material_index = skin_index; skin_faces += 1
assert skin_faces > 500 and hair_faces > 500

# Gentle surface relaxation outside the mouth aperture. This changes evaluated
# surface shading/shape, not mesh connectivity or the source's skin weights.
group = body.vertex_groups.new(name='V012_Local_Surface_Relaxation')
for v in body.data.vertices:
    x,y,z = v.co
    mouth = math.exp(-((x/.046)**2+((z-.762)/.025)**2))
    weight = .3 * max(0.,1-mouth) if .73 < z < .89 and y < -.075 else 0.
    if weight: group.add([v.index], weight, 'REPLACE')
modifier = body.modifiers.new('V012 gentle cheek surface relaxation', 'SMOOTH')
modifier.vertex_group = group.name; modifier.factor = .3; modifier.iterations = 4
# Native UV seams contain disconnected vertices. Relaxing them independently
# opens cracks; retain this disabled experiment for traceability.
modifier.show_render = False; modifier.show_viewport = False

# Narrow the upper lid opening to an almond contour, preserving the full Blink
# key and its driver. Outer rings remain fixed against the original face.
for side in ['L','R']:
    lid = bpy.data.objects['EYELIDS.'+side]
    basis = lid.data.shape_keys.key_blocks['Basis']
    for i, v in enumerate(basis.data):
        ring, index = divmod(i,96); f = ring/11; t = 2*math.pi*index/96
        dz = (-.0035 if math.sin(t)>0 else .0015) * abs(math.sin(t))**1.3 * (1-f)**2
        v.co.z += dz; lid.data.vertices[i].co.z += dz
    lid.data.update()
for name in ['Draft eyelid skin', 'Draft lips and facial transition']:
    material = bpy.data.materials[name]
    set_input(material, 'Roughness', .48)
    set_input(material, 'Subsurface Weight', .08)
    set_input(material, 'Subsurface Scale', .0012)
set_input(bpy.data.materials['Warm eye white'], 'Base Color', (.64,.61,.53,1))
set_input(bpy.data.materials['Warm eye white'], 'Roughness', .12)
set_input(bpy.data.materials['Warm eye white'], 'Coat Weight', .5)
set_input(bpy.data.materials['Warm eye white'], 'Coat Roughness', .08)
set_input(bpy.data.materials['Pupil'], 'Roughness', .09)
set_input(bpy.data.materials['Brown iris'], 'Roughness', .22)
set_input(bpy.data.materials['Brown iris'], 'Coat Weight', .4)
nodes, links = bpy.data.materials['Brown iris'].node_tree.nodes, bpy.data.materials['Brown iris'].node_tree.links
noise = nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=38; noise.inputs['Detail'].default_value=3
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color=(.045,.017,.006,1)
ramp.color_ramp.elements[1].color=(.20,.085,.022,1)
links.new(noise.outputs['Fac'],ramp.inputs[0]);links.new(ramp.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])

# Curves follow the native hair surface rather than replacing the character
# with a new generated image. Each curve is attached to the existing head bone.
surface = BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices], [p.vertices[:] for p in body.data.polygons])
strand_material = bpy.data.materials.new('V012 fine brown hair'); strand_material.use_nodes=True
bs = strand_material.node_tree.nodes.get('Principled BSDF')
bs.inputs['Base Color'].default_value=(.058,.025,.009,1)
bs.inputs['Roughness'].default_value=.36;bs.inputs['Anisotropic'].default_value=.35
curve = bpy.data.curves.new('V012 surface-following hair strands','CURVE')
curve.dimensions='3D';curve.resolution_u=2;curve.bevel_depth=.000035;curve.bevel_resolution=1
curve.materials.append(strand_material)
rng = random.Random(12012)
candidates = [i for i in hair_vertices if body.data.vertices[i].co.y < .08]
rng.shuffle(candidates)
strand_count=0
for index in candidates[:1800]:
    v=body.data.vertices[index]; normal=v.normal.normalized()
    direction=Vector((-.65,.15,-.8));direction-=normal*direction.dot(normal)
    if direction.length<.01: continue
    direction.normalize();length=rng.uniform(.006,.023)
    points=[]
    for step in range(7):
        u=step/6;target=v.co+direction*length*u
        nearest,n,_,_=surface.find_nearest(target)
        if nearest is None or nearest.z < .874:break
        points.append(nearest+n*(.00012+.00022*math.sin(math.pi*u)))
    if len(points)<4:continue
    spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
    for i,p in enumerate(points):
        spline.points[i].co=(*p,1);spline.points[i].radius=1-.75*i/(len(points)-1)
    strand_count+=1
strands=bpy.data.objects.new('V012_HEAD_HAIR_FINE_STRANDS',curve);s.collection.objects.link(strands)
bpy.context.view_layer.update();world=strands.matrix_world.copy()
strands.parent=rig;strands.parent_type='BONE';strands.parent_bone='head';strands.matrix_world=world
assert strand_count > 500

for o in list(s.objects):
    if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
def area(name,location,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=location
    o.rotation_euler=(Vector((0,-.07,.84))-o.location).to_track_quat('-Z','Y').to_euler()
area('V012 warm soft key',(-.3,-.5,1.2),4.5,.35,(1.,.79,.63))
area('V012 cool fill',(.4,-.35,.9),1.6,.45,(.64,.79,1.))
area('V012 hair separation',(.2,.18,1.1),5.,.25,(1.,.67,.39))
s.world.node_tree.nodes.get('Background').inputs[0].default_value=(.08,.12,.15,1)
s.world.node_tree.nodes.get('Background').inputs[1].default_value=.24
camera=s.camera;camera.data.type='PERSP';camera.data.lens=65
camera.location=(.10,-1.1,.88)
camera.rotation_euler=(Vector((0,-.04,.845))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.dof.use_dof=False
s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100
s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True
s.render.use_sequencer=False;s.render.image_settings.file_format='PNG'
s['status']='DRAFT_FILM_LOOKDEV_V012_NOT_APPROVED';s['production_approved']=False;s['quality_gate_passed']=False
assert len(body.data.vertices)==original_vertex_count and len(rig.animation_data.drivers)==source_driver_count
output.mkdir(parents=True)
bpy.ops.file.pack_all();dest=output/'CHAR_MARK_FILM_LOOKDEV_V012_DRAFT.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
(output/'lookdev_manifest.json').write_text(json.dumps({'source_sha256':expected,'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'native_vertices':original_vertex_count,'fine_hair_strands':strand_count,'skin_material_faces':skin_faces,'hair_material_faces':hair_faces,'resolution':[1920,1080],'production_approved':False,'quality_gate_passed':False,'limitations':['native sculpt silhouette and topology still draft','not a completed character master','lip corners and skin seams require further sculpting']},indent=2))
print('FILM_LOOKDEV_SAVED',strand_count,skin_faces,hair_faces)
s.render.filepath=str(output/'Wonderly_Tales_Mark_V012_1080p_DRAFT.png')
bpy.ops.render.render(write_still=True)
print('FILM_LOOKDEV_RENDERED')
