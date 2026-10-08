"""Render a bounded native scene range on verified Blackwell hardware.

Blender --background --disable-autoexec --python native_gpu_scene.py -- job.json
No proxy substitution, frame duplication, or CPU fallback is permitted.
"""
import bpy
import json
import sys
import time
from pathlib import Path

job = json.loads(Path(sys.argv[sys.argv.index('--') + 1]).read_text())
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.get_devices()
gpus = [d for d in prefs.devices if d.type == 'OPTIX' and 'RTX PRO 6000' in d.name]
if not gpus:
    raise RuntimeError('RTX PRO 6000 OPTIX device unavailable; CPU fallback forbidden')
for device in prefs.devices:
    device.use = device in gpus
devices = [{'name': d.name, 'backend': d.type} for d in gpus]
if job['operation'] == 'CHECK_GPU_ACCESS':
    print('WONDERLY_NATIVE_RESULT ' + json.dumps({'status': 'VERIFIED', 'devices': devices}))
else:
    bpy.ops.wm.open_mainfile(filepath=job['scene'], use_scripts=False)
    scene = bpy.context.scene
    start, end = job['frame_start'], job['frame_end']
    if start < scene.frame_start or end > scene.frame_end:
        raise ValueError('Requested frames outside authored scene timeline')
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = job['samples']
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = job['width'], job['height']
    scene.render.resolution_percentage = 100
    scene.render.fps = 24
    scene.render.fps_base = 1
    scene.render.use_sequencer = False
    scene.render.use_persistent_data = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    output = Path(job['output'])
    output.mkdir(parents=True, exist_ok=True)
    elapsed = []
    for frame in range(start, end + 1):
        started = time.monotonic()
        scene.frame_set(frame)
        for obj in scene.objects:
            if obj.type == 'ARMATURE':
                obj.update_tag(refresh={'OBJECT'})
        bpy.context.view_layer.update()
        scene.render.filepath = str(output / f'frame_{frame:06d}.png')
        bpy.ops.render.render(write_still=True)
        elapsed.append(time.monotonic() - started)
    print('WONDERLY_NATIVE_RESULT ' + json.dumps({
        'status': 'RENDERED', 'devices': devices, 'frame_start': start, 'frame_end': end,
        'frames': len(elapsed), 'width': job['width'], 'height': job['height'],
        'samples': job['samples'], 'fps': 24, 'native_frame_step': 1,
        'frame_seconds': elapsed, 'production_approved': False,
    }))
