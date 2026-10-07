"""Reopen a draft and check packed audio plus evaluated jaw/lip movement.
Blender --python this.py -- SCENE TIMING OUTPUT_JSON
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
import numpy as np

scene_path, timing_path, report_path = map(Path, sys.argv[sys.argv.index('--') + 1:])
timing = json.loads(timing_path.read_text())
bpy.ops.wm.open_mainfile(filepath=str(scene_path.resolve()))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert len(bpy.data.sounds) == 1
sound = bpy.data.sounds[0]
assert sound.packed_file and hashlib.sha256(sound.packed_file.data).hexdigest() == timing['audio_sha256']
assert scene.frame_end == timing['frame_count'] and scene.render.fps == timing['fps']
assert rig.animation_data.drivers
lip = bpy.data.objects['MOUTH_LIPS']
def coordinates(frame):
    scene.frame_set(frame)
    rig.update_tag(refresh={'OBJECT'})
    bpy.context.view_layer.update()
    mesh = lip.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    values = np.array([v.co[:] for v in mesh.vertices])
    lip.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
    return values
closed = coordinates(1)
peak = int(np.argmax(timing['jaw_values'])) + 1
opened = coordinates(peak)
distance = np.linalg.norm(opened - closed, axis=1)
angle = float(rig.pose.bones['jaw'].rotation_euler.x)
assert float(distance.max()) > .001 and angle > .1
coordinates(scene.frame_end)
assert abs(float(rig.pose.bones['jaw'].rotation_euler.x)) < 1e-6
report = {'reopened': True, 'packed_audio_matches_current_recording': True,
          'audio_sha256': timing['audio_sha256'], 'frame_count': scene.frame_end,
          'fps': scene.render.fps, 'peak_frame': peak,
          'evaluated_lip_max_displacement': float(distance.max()),
          'peak_jaw_angle_rad': angle, 'silent_tail_jaw_closed': True,
          'phoneme_alignment': False, 'production_approved': False}
report_path.write_text(json.dumps(report, indent=2))
print('CURRENT_AUDIO_REOPEN_QC_OK', json.dumps(report))
