"""Matched native views for binding review. Diagnostic, not final lighting."""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector
source, registry, dest = map(Path, sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
reg=json.loads(registry.read_text());scene=bpy.context.scene;dest.mkdir(parents=True,exist_ok=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
scene.cycles.use_denoising=True;scene.cycles.max_bounces=4
scene.render.resolution_x=768;scene.render.resolution_y=576;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.use_sequencer=False
scene.timeline_markers.clear()
visibility={o.name:o.hide_render for o in scene.objects}
for code,frame in [('CHAR_LILI',265),('CHAR_LILI',1153),('CHAR_POTTY',889),('CHAR_ZIZI',1177)]:
    for other,asset in reg['characters'].items():
        collection=bpy.data.collections.get(asset['collection'])
        if collection:
            for obj in list(collection.all_objects):
                if obj:obj.hide_render=True if other!=code else visibility.get(obj.name,False)
        for obj in scene.objects:
            if other in obj.name:
                obj.hide_render=True if other!=code else visibility.get(obj.name,False)
    scene.frame_set(frame)
    body=bpy.data.objects[reg['characters'][code]['body']]
    dep=bpy.context.evaluated_depsgraph_get();ev=body.evaluated_get(dep)
    bounds=[ev.matrix_world@Vector(v) for v in ev.bound_box]
    low=Vector([min(v[i] for v in bounds) for i in range(3)])
    high=Vector([max(v[i] for v in bounds) for i in range(3)])
    center=(low+high)*.5;size=max(high-low)
    root=bpy.data.objects[reg['characters'][code]['root']]
    direction=root.matrix_world.to_quaternion()@Vector((.8,-1.5,.65)).normalized()
    cam=scene.camera;cam.location=center+direction*size*2.5
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=50
    scene.render.filepath=str((dest/f'{code}_{frame}.png').resolve())
    bpy.ops.render.render(write_still=True)
    print('CLOSEUP_READY',code,frame,flush=True)
