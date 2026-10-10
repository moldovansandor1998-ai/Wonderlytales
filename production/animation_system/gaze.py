"""Bounded head-relative eye aiming without the inherited unconstrained roll.

The sclera is a complete, head-bound ellipsoid. The existing independent eye
bones still move the iris/pupil. This is a candidate repair, not visual approval.
"""
import math
import bpy
from mathutils import Vector
from .spec import FACE_PROFILES


def stabilize_sclera(code, rig):
    changed = []
    for side, (x, z, w, h) in zip(('R', 'L'), FACE_PROFILES[code]['eyes']):
        obj = bpy.data.objects.get(code + '_EYEBALL.' + side)
        if obj is None:
            continue
        centre = rig.data.bones['eye.' + side].head_local.copy()
        centre.y -= w * .03  # Original cap centre is .72w, bone pivot is .75w.
        radius = w * .90
        n, rings = 48, 32
        verts = [tuple(centre + Vector((0, -radius, 0)))]
        for k in range(1, rings):
            theta = math.pi * k / rings
            for j in range(n):
                angle = math.tau * j / n
                verts.append(tuple(centre + Vector((radius * math.sin(theta) * math.cos(angle),
                    -radius * math.cos(theta), radius * math.sin(theta) * math.sin(angle) * h / w))))
        back = len(verts)
        verts.append(tuple(centre + Vector((0, radius, 0))))
        faces = [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)]
        faces += [(1 + k*n+j, 1 + (k+1)*n+j, 1 + (k+1)*n+(j+1)%n, 1 + k*n+(j+1)%n)
                  for k in range(rings-2) for j in range(n)]
        faces += [(1 + (rings-2)*n+j, back, 1 + (rings-2)*n+(j+1)%n) for j in range(n)]
        data = bpy.data.meshes.new(obj.name + '_closed_V025')
        data.from_pydata(verts, [], faces)
        for material in obj.data.materials:
            data.materials.append(material)
        obj.data = data
        obj.vertex_groups.clear()
        obj.vertex_groups.new(name='head').add(list(range(len(verts))), 1., 'REPLACE')
        for face in data.polygons:
            face.use_smooth = True
        obj['sclera_revision'] = 'V025_HEAD_FIXED_CLOSED'
        # The source globe is ellipsoidal. Rotating an ellipsoidal iris cap as a
        # rigid mesh can bury it inside the fixed sclera; conform it afterwards.
        for label, offset in (('IRIS', .00045), ('PUPIL', .0009)):
            cap = bpy.data.objects.get(code + '_' + label + '.' + side)
            if cap is None:
                raise ValueError('Missing independent eye cap: ' + code + ' ' + label)
            old = cap.modifiers.get('V025 globe surface')
            if old:
                cap.modifiers.remove(old)
            modifier = cap.modifiers.new('V025 globe surface', 'SHRINKWRAP')
            modifier.target = obj
            modifier.wrap_method = 'NEAREST_SURFACEPOINT'
            modifier.wrap_mode = 'ABOVE_SURFACE'
            modifier.offset = offset
        changed.append(obj.name)
    return changed


def bake_bounded_gaze(scene, rigs, yaw_limit=.28, pitch_limit=.20):
    """Bake safe eye controls from existing animated targets, in head-local space."""
    for rig in rigs.values():
        # Earlier scene compilation assigned integer zeros, collapsing the RNA
        # custom-property bounds to [0, 0]. F-curves then silently evaluate to 0.
        for side in ('L', 'R'):
            for axis, limit in (('yaw', yaw_limit), ('pitch', pitch_limit)):
                prop = 'gaze_' + axis + '.' + side
                rig[prop] = float(rig.get(prop, 0.))
                rig.id_properties_ui(prop).update(min=-limit, max=limit, soft_min=-limit, soft_max=limit)
        for side in ('L', 'R'):
            bone = rig.pose.bones['eye.' + side]
            for constraint in list(bone.constraints):
                if constraint.name in ('Native 3D gaze', 'Anatomical eye range'):
                    bone.constraints.remove(constraint)
    prior = {}
    max_step = .10  # At most 5.73 degrees per frame; no one-frame target flip.
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for code, rig in rigs.items():
            target = bpy.data.objects.get(code + '_GAZE_TARGET_V021')
            evaluated = rig.evaluated_get(depsgraph)
            head = evaluated.pose.bones['head']
            for side in ('L', 'R'):
                rest = rig.data.bones['eye.' + side]
                base = evaluated.matrix_world @ head.matrix @ head.bone.matrix_local.inverted() @ rest.matrix_local
                direction = base.inverted() @ target.matrix_world.translation if target else Vector((0, 1, 0))
                enabled = float(rig.get('auto_gaze', 0.)) if target else 0.
                yaw = max(-yaw_limit, min(yaw_limit, -math.atan2(direction.x, direction.y))) * enabled
                pitch = max(-pitch_limit, min(pitch_limit, math.atan2(direction.z, math.hypot(direction.x, direction.y)))) * enabled
                for axis, value in (('yaw', yaw), ('pitch', pitch)):
                    prop = 'gaze_' + axis + '.' + side
                    previous = prior.get((code, prop), value)
                    value = previous + max(-max_step, min(max_step, value - previous))
                    prior[code, prop] = value
                    rig[prop] = value
                    rig.keyframe_insert('["' + prop + '"]', frame=frame)
        if frame % 240 == 0:
            print('GAZE_BAKED', frame, flush=True)
    for rig in rigs.values():
        for layer in rig.animation_data.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    if bag.slot_handle == rig.animation_data.action_slot_handle:
                        for curve in bag.fcurves:
                            if 'gaze_' in curve.data_path:
                                curve.update_autoflags(rig)
                                for point in curve.keyframe_points:
                                    point.interpolation = 'LINEAR'
    scene.frame_set(scene.frame_start)
    return {'yaw_limit_rad': yaw_limit, 'pitch_limit_rad': pitch_limit,
            'max_axis_step_rad_per_frame': max_step, 'frames': scene.frame_end-scene.frame_start+1,
            'professional_quality_approved': False}
