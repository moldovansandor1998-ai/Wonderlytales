"""Create a separate V025 gaze candidate and paired native diagnostic frames."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from animation_system.gaze import stabilize_sclera, bake_bounded_gaze
from animation_system.spec import FACE_PROFILES, digest, atomic_json


def audit(scene, rigs):
    result = {code: {'max_eye_angle_deg': 0., 'max_interframe_eye_angle_deg': 0.} for code in rigs}
    previous = {}
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        dep = bpy.context.evaluated_depsgraph_get()
        for code, rig in rigs.items():
            evaluated = rig.evaluated_get(dep)
            head = evaluated.pose.bones['head']
            for side in ('L', 'R'):
                bone = evaluated.pose.bones['eye.' + side]
                base = head.matrix @ head.bone.matrix_local.inverted() @ bone.bone.matrix_local
                local = base.to_3x3().inverted() @ (bone.matrix.to_3x3() @ Vector((0, 1, 0)))
                angle = math.degrees(local.angle(Vector((0, 1, 0))))
                result[code]['max_eye_angle_deg'] = max(result[code]['max_eye_angle_deg'], angle)
                if (code, side) in previous:
                    step = math.degrees(local.angle(previous[code, side]))
                    result[code]['max_interframe_eye_angle_deg'] = max(result[code]['max_interframe_eye_angle_deg'], step)
                previous[code, side] = local
    return result


def main():
    source, destination, proofs = map(Path, sys.argv[sys.argv.index('--')+1:])
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError('Repair requires a new candidate path')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
    scene = bpy.context.scene
    rigs = {code: next(o for o in scene.objects if o.type == 'ARMATURE' and code in o.name)
            for code in FACE_PROFILES if any(o.type == 'ARMATURE' and code in o.name for o in scene.objects)}
    before = audit(scene, rigs)
    fixed = {code: stabilize_sclera(code, rig) for code, rig in rigs.items()}
    bake = bake_bounded_gaze(scene, rigs)
    after = audit(scene, rigs)
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()), compress=True)
    report = {'source_sha256': digest(source), 'candidate_sha256': digest(destination),
              'before': before, 'after': after, 'sclera': fixed, 'bake': bake,
              'production_approved': False, 'note': 'Requires rendered iris, lid and seam inspection'}
    atomic_json(destination.with_suffix('.gaze.json'), report)
    print('GAZE_REPORT', json.dumps(report), flush=True)
    if str(proofs) != 'none':
        proofs.mkdir(parents=True, exist_ok=True)
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 12
        scene.cycles.use_denoising = True
        scene.render.resolution_x = 960
        scene.render.resolution_y = 540
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.render.use_sequencer = False
        for frame in (145, 217, 289):
            scene.frame_set(frame)
            scene.render.filepath = str((proofs / f'frame_{frame:04d}.png').resolve())
            bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    main()
