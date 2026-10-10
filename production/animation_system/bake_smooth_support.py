"""Smooth native pelvis travel inside each frame's reachable support region.

Fixed foot targets and limb lengths are preserved. Each proposed pelvis point
is projected into the intersection of the limb reach balls. This is a separate
candidate bake and still requires evaluated full-frame geometry validation.
"""
import bpy, json, sys
import numpy as np
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest, atomic_json

source, registry, destination = map(Path, sys.argv[sys.argv.index('--')+1:])
if source.resolve() == destination.resolve():
    raise ValueError('Separate candidate required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
scene = bpy.context.scene
assets = {c:a for c,a in json.loads(registry.read_text())['characters'].items()
          if bpy.data.objects.get(a['rig'])}
samples = {c:[] for c in assets}
frames = range(scene.frame_start, scene.frame_end + 1)
for frame in frames:
    scene.frame_set(frame)
    for code, asset in assets.items():
        rig = bpy.data.objects[asset['rig']]
        ev = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        position = ev.matrix_world @ ev.pose.bones['CTRL_pelvis'].head
        centers, radii = [], []
        for foot in asset['feet']:
            hip = ev.matrix_world @ ev.pose.bones[foot['upper']].head
            target = ev.matrix_world @ ev.pose.bones[foot['control']].head
            centers.append(list(position + target - hip))
            radii.append(sum(ev.data.bones[n].length for n in
                             (foot['upper'], foot['lower'])) * ev.matrix_world.to_scale().x * .96)
        samples[code].append((list(position), centers, radii))

report = {'source_sha256':digest(source), 'blender':bpy.app.version_string,
          'frames':len(frames), 'production_approved':False,
          'fixed_foot_targets':True, 'method':'temporal relaxation with reachable-region projection',
          'characters':{}}
curves = {}
for code, records in samples.items():
    original = np.array([r[0] for r in records]); curve = original.copy()
    centers = np.array([r[1] for r in records]); radii = np.array([r[2] for r in records])
    for iteration in range(100):
        candidate = curve.copy()
        candidate[1:-1] = .15*original[1:-1] + .85*(curve[:-2]+curve[2:])*.5
        for _ in range(12):
            for limb in range(centers.shape[1]):
                delta = candidate-centers[:,limb]
                length = np.linalg.norm(delta,axis=1)
                ratio = np.minimum(1.,radii[:,limb]/np.maximum(length,1e-10))
                candidate = centers[:,limb] + delta*ratio[:,None]
        curve = candidate
    residual = np.max(np.linalg.norm(curve[:,None,:]-centers,axis=2)-radii)
    deviation = np.linalg.norm(curve-original,axis=1)
    if residual > .002 or deviation.max() > .12:
        raise ValueError(f'{code}: support smoothing exceeds reach/deviation limits')
    curves[code] = curve-original
    report['characters'][code] = {
        'max_correction_m':float(deviation.max()), 'max_reach_residual_m':float(max(0,residual)),
        'before_max_second_difference_m':float(np.linalg.norm(np.diff(original,n=2,axis=0),axis=1).max()),
        'after_max_second_difference_m':float(np.linalg.norm(np.diff(curve,n=2,axis=0),axis=1).max())}
for index, frame in enumerate(frames):
    scene.frame_set(frame)
    for code, asset in assets.items():
        rig = bpy.data.objects[asset['rig']]; pelvis = rig.pose.bones['CTRL_pelvis']
        shift = rig.matrix_world.inverted().to_3x3() @ Vector(curves[code][index])
        pelvis.location += pelvis.bone.matrix_local.to_3x3().inverted() @ shift
        pelvis.keyframe_insert('location',frame=frame)
    if frame % 240 == 0: print('SMOOTH_SUPPORT_FRAME',frame,flush=True)
scene.frame_set(1); scene['production_approved'] = False
bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()),compress=True)
report['candidate_sha256'] = digest(destination)
atomic_json(destination.with_suffix('.smooth-support.json'),report)
