"""Blender-only actual native mesh review. Never a production approval.

blender -b -t 2 --python render_native_body_motion.py -- manifest.json output
Manifest: [{"character": "CHAR_MARK", "blend": "/absolute/file.blend"}, ...]
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
assets = json.loads(Path(args[0]).read_text())
out = Path(args[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.cycles.use_denoising = True
scene.render.resolution_x = 960
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.fps = 12
scene.frame_start, scene.frame_end = 1, 24
scene.world = bpy.data.worlds.new('Review world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.12, .16, .22, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
rigs = []
report = []
for i, asset in enumerate(assets):
    with bpy.data.libraries.load(asset['blend'], link=False) as (src, dst):
        dst.objects = list(src.objects)
    objects = [o for o in dst.objects if o and (o.type == 'ARMATURE' or (o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)))]
    for obj in objects:
        scene.collection.objects.link(obj)
    meshes = [o for o in objects if o.type == 'MESH']
    arms = [o for o in objects if o.type == 'ARMATURE']
    assert len(arms) == 1 and meshes, asset
    rig = arms[0]
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.rotation_mode = 'XYZ'
        bone.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    low = Vector(tuple(min(p[k] for p in corners) for k in range(3)))
    high = Vector(tuple(max(p[k] for p in corners) for k in range(3)))
    scale = 1.6 / (high.z - low.z)
    pivot = bpy.data.objects.new(asset['character'] + '_placement', None)
    scene.collection.objects.link(pivot)
    for obj in objects:
        if obj.parent not in objects:
            obj.parent = pivot
    pivot.scale = (scale,) * 3
    pivot.location = ((i - (len(assets)-1)/2) * 1.35 - (low.x+high.x)/2*scale, -(low.y+high.y)/2*scale, -low.z*scale)
    for frame, amount in [(1, 0), (7, .11), (13, 0), (19, -.11), (24, 0)]:
        for name in ['head', 'tail_01', 'upper_arm.L']:
            bone = rig.pose.bones.get(name)
            if bone:
                bone.rotation_euler[1 if name == 'head' else 0] = amount
                bone.keyframe_insert(data_path='rotation_euler', frame=frame)
    rigs.append((rig, meshes))
    report.append({'character': asset['character'], 'source': asset['blend'], 'bones': len(rig.data.bones), 'vertices': sum(len(m.data.vertices) for m in meshes), 'facial_ready': False, 'production_approved': False})

bpy.ops.mesh.primitive_plane_add(size=200)
floor = bpy.context.object
mat = bpy.data.materials.new('Review floor')
mat.diffuse_color = (.085, .12, .16, 1)
floor.data.materials.append(mat)
for name, position, power, size in [('Key', (0, -4, 6), 1400, 7), ('Rim', (0, 3, 5), 1100, 6)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size = power, 'DISK', size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (Vector((0, 0, .8)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
cam = bpy.data.objects.new('Review camera', bpy.data.cameras.new('Review camera'))
scene.collection.objects.link(cam)
cam.location = (0, -10, 3.0)
cam.rotation_euler = (Vector((0, 0, .85)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = len(assets) * 1.35 + .4
scene.camera = cam
scene['status'] = 'DRAFT_NATIVE_BODY_MOTION_REVIEW'
scene['facial_ready'] = False
scene['production_approved'] = False
scene.frame_set(1)
deps = bpy.context.evaluated_depsgraph_get()
baseline = [[v.co.copy() for v in meshes[0].evaluated_get(deps).data.vertices] for _, meshes in rigs]
scene.frame_set(7)
deps = bpy.context.evaluated_depsgraph_get()
for item, (_, meshes), before in zip(report, rigs, baseline):
    after = meshes[0].evaluated_get(deps).data.vertices
    distances = [(v.co-b).length for v,b in zip(after,before)]
    item['max_deformation'] = max(distances)
    item['moving_vertices'] = sum(d > 1e-6 for d in distances)
    assert item['moving_vertices'] > 0, item
(out/'motion_report.json').write_text(json.dumps({'blender': bpy.app.version_string, 'fps': 12, 'frames': 24, 'characters': report}, indent=2))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'native_body_motion_DRAFT.blend'), compress=True)
scene.render.filepath = str(out/'frame_')
bpy.ops.render.render(animation=True)
