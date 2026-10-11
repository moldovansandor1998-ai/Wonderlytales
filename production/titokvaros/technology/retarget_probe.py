"""Integration test: unmodified Rokoko retargeter -> Rigify -> Blender FBX round-trip.

This invokes established tools; it does not generate motion or approve acting.
The rejected Mira mesh is only a disposable compatibility fixture. No rendering.
"""
import argparse
import bpy
import hashlib
import importlib.util
import json
import math
import sys
import traceback
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--addon', type=Path, required=True)
p.add_argument('--character', type=Path, required=True)
p.add_argument('--bvh', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
a.output.mkdir(parents=True, exist_ok=True)
out = a.output / a.bvh.stem
result = {'blender': bpy.app.version_string, 'source': a.bvh.name,
          'source_sha256': hashlib.sha256(a.bvh.read_bytes()).hexdigest(),
          'retargeter': 'Rokoko Studio Live 1.4.3 (unmodified)',
          'target': 'Mira V001 Rigify — REJECTED visual fixture',
          'production_approved': False, 'unreal_import_tested': False,
          'ai_capture_tested': False, 'visual_quality_approved': False}

def snapshot(rig, frames, names):
    poses = {}
    for f in frames:
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        poses[f] = {n: list(rig.matrix_world @ rig.pose.bones[n].head) for n in names}
    return poses

def shapes():
    return {o.name: sorted(o.data.shape_keys.key_blocks.keys()) for o in bpy.data.objects
            if o.type == 'MESH' and o.data.shape_keys}

try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with bpy.data.libraries.load(str(a.character.resolve()), link=False) as (available, loaded):
        loaded.collections = [n for n in available.collections if n == 'TV_CHAR_MIRA']
    if not loaded.collections:
        raise ValueError('Expected TV_CHAR_MIRA collection missing')
    for collection in loaded.collections:
        bpy.context.scene.collection.children.link(collection)
    target = bpy.data.objects['TV_CHAR_MIRA_RIG']
    target.animation_data_clear()
    target.location = (0, 0, 0)
    target.rotation_euler = (0, 0, 0)
    for b in target.pose.bones:
        b.matrix_basis.identity()
    for side in ['L', 'R']:
        for name in ['upper_arm_parent.', 'thigh_parent.']:
            target.pose.bones[name + side]['IK_FK'] = 1.0
    bpy.context.scene.render.fps = 24
    bpy.ops.preferences.addon_enable(module='io_anim_bvh')
    bpy.ops.import_anim.bvh(filepath=str(a.bvh.resolve()), global_scale=0.0254,
                            frame_start=1, use_fps_scale=True, update_scene_fps=False,
                            rotate_mode='QUATERNION')
    source = bpy.context.object
    result['source_bones'] = len(source.data.bones)
    result['source_action_range_24fps'] = list(source.animation_data.action.frame_range)
    # The conversion prepends a calibration pose. Keep it for retargeting, but
    # exclude its frame and transition from exported review motion.
    end = int(math.floor(source.animation_data.action.frame_range[1]))
    bpy.context.scene.frame_start = 2
    bpy.context.scene.frame_end = end
    bpy.context.scene.frame_set(1)
    spec = importlib.util.spec_from_file_location('rokoko_studio_live_blender',
            a.addon / '__init__.py', submodule_search_locations=[str(a.addon)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.register()
    scene = bpy.context.scene
    scene.rsl_retargeting_armature_source = source
    scene.rsl_retargeting_armature_target = target
    scene.rsl_retargeting_use_pose = 'REST'
    scene.rsl_retargeting_auto_scaling = True
    mapping = {'Hips':'torso', 'Spine':'hips', 'Spine1':'chest', 'Neck1':'neck', 'Head':'head'}
    for side, suffix in [('Left','L'), ('Right','R')]:
        for src, dst in [('Arm','upper_arm_fk'), ('ForeArm','forearm_fk'), ('Hand','hand_fk'),
                         ('UpLeg','thigh_fk'), ('Leg','shin_fk'), ('Foot','foot_fk'), ('ToeBase','toe')]:
            mapping[side + src] = dst + '.' + suffix
    missing = [(s,t) for s,t in mapping.items() if s not in source.pose.bones or t not in target.pose.bones]
    if missing:
        raise ValueError('Explicit mapping missing bones: ' + repr(missing))
    for src, dst in mapping.items():
        item = scene.rsl_retargeting_bone_list.add()
        item.bone_name_source, item.bone_name_target = src, dst
    result['bone_mapping'] = mapping
    response = bpy.ops.rsl.retarget_animation()
    if 'FINISHED' not in response:
        raise RuntimeError('Rokoko retarget did not finish: ' + repr(response))
    result['retarget_completed'] = True
    result['target_action'] = target.animation_data.action.name
    result['target_action_curves'] = len(target.animation_data.action.fcurves)
    bpy.data.objects.remove(source, do_unlink=True)
    # Drivers/UI source remain in the authored blend; FBX bakes native evaluated
    # transforms. No claim that Rigify controls survive inside Unreal.
    meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('MIRA')]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [target] + meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = target
    frames = sorted(set([2, max(2, end//2), end]))
    names = [b.name for b in target.data.bones if b.use_deform]
    before = snapshot(target, frames, names)
    expected_shapes = shapes()
    result['native_deform_bones'] = len(names)
    result['native_shape_key_meshes'] = expected_shapes
    result['sample_frames'] = frames
    result['calibration_pose_artist_approved'] = False
    result['finger_face_tail_performance'] = 'NOT_IN_BODY_MOCAP'
    bpy.ops.wm.save_as_mainfile(filepath=str(out.with_suffix('.blend').resolve()), compress=True)
    bpy.ops.export_scene.fbx(filepath=str(out.with_suffix('.fbx').resolve()), use_selection=True,
        object_types={'ARMATURE','MESH'}, add_leaf_bones=False, use_armature_deform_only=True,
        bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False,
        bake_anim_simplify_factor=0, bake_anim_step=1, use_mesh_modifiers=False,
        apply_unit_scale=True, apply_scale_options='FBX_SCALE_UNITS', axis_forward='-Y', axis_up='Z')
    module.unregister()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.fbx(filepath=str(out.with_suffix('.fbx').resolve()),
                             use_anim=True, anim_offset=2, automatic_bone_orientation=False)
    rigs = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if len(rigs) != 1:
        raise ValueError('FBX has unexpected armature count: ' + str(len(rigs)))
    imported = rigs[0]
    missing = [n for n in names if n not in imported.pose.bones]
    result['roundtrip_missing_deform_bones'] = missing
    result['roundtrip_roots'] = [b.name for b in imported.data.bones if not b.parent]
    result['roundtrip_bones'] = len(imported.data.bones)
    result['roundtrip_helper_bones'] = [b.name for b in imported.data.bones if b.name.startswith(('MCH-', 'ORG-'))]
    result['roundtrip_shape_key_meshes'] = shapes()
    result['shape_key_names_preserved'] = shapes() == expected_shapes
    result['roundtrip_action_range'] = list(imported.animation_data.action.frame_range) if imported.animation_data else None
    if not missing:
        after = snapshot(imported, frames, names)
        result['max_sampled_bone_head_error_m'] = max(math.dist(before[f][n], after[f][n]) for f in frames for n in names)
    result['fbx_sha256'] = hashlib.sha256(out.with_suffix('.fbx').read_bytes()).hexdigest()
    result['blend_sha256'] = hashlib.sha256(out.with_suffix('.blend').read_bytes()).hexdigest()
    result['status'] = 'COMPLETED_DIAGNOSTIC_ONLY'
except Exception:
    result['status'] = 'FAILED'
    result['error'] = traceback.format_exc()
out.with_suffix('.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False, indent=2))
if result['status'] == 'FAILED':
    raise RuntimeError('Integration probe failed; see audit JSON')
