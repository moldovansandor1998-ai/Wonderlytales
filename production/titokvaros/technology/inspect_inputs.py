"""Read-only source audit, run with official Blender; never executes embedded scripts."""
import bpy
import bmesh
import json
import sys
from pathlib import Path

root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(root / 'fox_review.fbx'))
result = {
    'blender': bpy.app.version_string,
    'source': 'User-provided anthropomorphic+fox+3d+model.zip',
    'production_approved': False,
    'rights': 'NO_LICENSE_DOCUMENT_IN_ARCHIVE',
    'objects': [],
}
for obj in bpy.data.objects:
    row = {'name': obj.name, 'type': obj.type}
    if obj.type == 'MESH':
        row.update(vertices=len(obj.data.vertices), polygons=len(obj.data.polygons),
                   uv_layers=len(obj.data.uv_layers), vertex_groups=len(obj.vertex_groups),
                   shape_keys=list(obj.data.shape_keys.key_blocks.keys()) if obj.data.shape_keys else [],
                   armature_modifiers=sum(m.type == 'ARMATURE' for m in obj.modifiers))
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        row.update(triangles=sum(len(f.verts) == 3 for f in bm.faces),
                   quads=sum(len(f.verts) == 4 for f in bm.faces),
                   ngons=sum(len(f.verts) > 4 for f in bm.faces),
                   boundary_edges=sum(e.is_boundary for e in bm.edges),
                   nonmanifold_edges=sum(not e.is_manifold for e in bm.edges),
                   loose_vertices=sum(not v.link_edges for v in bm.verts),
                   color_attributes=list(obj.data.color_attributes.keys()),
                   dimensions=list(obj.dimensions),
                   material_names=[m.name for m in obj.data.materials if m])
        bm.free()
    if obj.type == 'ARMATURE':
        row.update(bones=len(obj.data.bones))
    result['objects'].append(row)
result['images'] = [{'name': i.name, 'size': list(i.size), 'packed': bool(i.packed_file)} for i in bpy.data.images]
result['actions'] = list(bpy.data.actions.keys())
result['rigged'] = any(o.type == 'ARMATURE' for o in bpy.data.objects)
(root / 'fox_input_audit.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))

# Actual input-mesh evidence, not a concept picture or a redesigned character.
from mathutils import Vector
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
points = [mesh.matrix_world @ Vector(c) for c in mesh.bound_box]
center = sum(points, Vector()) / 8
height = max(p.z for p in points) - min(p.z for p in points)
scale = 1.8 / max(height, 0.0001)
mesh.location = (mesh.location - center) * scale
mesh.scale *= scale
bpy.context.view_layer.update()
mat = bpy.data.materials.new('AUDIT_neutral_clay')
mat.diffuse_color = (.28, .36, .43, 1)
mesh.data.materials.clear()
mesh.data.materials.append(mat)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Audit_world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.14,.14,.14,1)
for name, loc, energy, size in [('key',(3,-4,4),450,4),('fill',(-3,-1,2),250,3),('rim',(1,3,3),500,2)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
camera = bpy.data.objects.new('AUDIT_camera', bpy.data.cameras.new('AUDIT_camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.5
for name, loc in [('front',(0,-5,.1)),('side',(5,0,.1)),('back',(0,5,.1))]:
    camera.location = loc
    camera.rotation_euler = (-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(root / ('felix_input_' + name + '.png'))
    bpy.ops.render.render(write_still=True)
