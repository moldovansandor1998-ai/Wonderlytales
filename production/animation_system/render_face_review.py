"""Matched native neutral/expression closeups for all six existing characters."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
source,registry,destination=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
reg=json.loads(registry.read_text());scene=bpy.context.scene;destination.mkdir(parents=True,exist_ok=True)
scene.timeline_markers.clear();scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=8
scene.cycles.max_bounces=4;scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=480;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.use_sequencer=False
camera=bpy.data.objects.new('Native facial review camera',bpy.data.cameras.new('Native facial review camera'))
scene.collection.objects.link(camera);scene.camera=camera;camera.data.lens=70
visibility={o.name:o.hide_render for o in scene.objects}
for code,asset in reg['characters'].items():
    for other,a in reg['characters'].items():
        collection=bpy.data.collections.get(a['collection'])
        if collection:
            for obj in collection.all_objects:
                if obj:obj.hide_render=True if other!=code else visibility.get(obj.name,False)
    for frame in (1,456):
        scene.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get();points=[]
        for suffix in ('_FACIAL_TOPOLOGY','_EYEBALL.L','_EYEBALL.R'):
            obj=bpy.data.objects[code+suffix].evaluated_get(dep)
            points.extend(obj.matrix_world@Vector(p) for p in obj.bound_box)
        low=Vector([min(p[i] for p in points) for i in range(3)]);high=Vector([max(p[i] for p in points) for i in range(3)])
        center=(low+high)*.5;size=max(high-low);center.z+=size*.08
        rotation=bpy.data.objects[asset['root']].matrix_world.to_quaternion()
        camera.location=center+rotation@Vector((0,-size*3.4,size*.12))
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str((destination/f'{code}_{frame}.png').resolve())
        bpy.ops.render.render(write_still=True);print('FACE_REVIEW_READY',code,frame,flush=True)
