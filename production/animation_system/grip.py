"""Shared rigid-object pickup/hold/release constraints, baked in world space.

Keeps the contact pose's relative transform (including orientation and scale).
Does not certify finger articulation: that is a separate evaluated mesh gate.
"""
import bpy
from mathutils import Matrix


def hand_matrix(rig, hand, depsgraph):
    evaluated=rig.evaluated_get(depsgraph)
    return evaluated.matrix_world@evaluated.pose.bones['hand.'+hand].matrix


def bake_attachment(scene, rig, hand, objects, grasp_frame, release_frame=None):
    if not scene.frame_start<=grasp_frame<=scene.frame_end:
        raise ValueError('Grasp is outside the scene')
    if release_frame is not None and not grasp_frame<release_frame<=scene.frame_end:
        raise ValueError('Release must follow grasp within the scene')
    scene.frame_set(grasp_frame)
    matrix=hand_matrix(rig,hand,bpy.context.evaluated_depsgraph_get())
    offsets={obj.name:matrix.inverted()@obj.matrix_world.copy() for obj in objects}
    # Snapshot all pre-existing animation first so insertion/interpolation cannot
    # alter any later samples during baking.
    samples={obj.name:[] for obj in objects}
    frozen={}
    maximum_position_error=0.
    maximum_angle_error=0.
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame)
        matrix=hand_matrix(rig,hand,bpy.context.evaluated_depsgraph_get())
        for obj in objects:
            world=obj.matrix_world.copy()
            if frame>=grasp_frame:
                if release_frame is None or frame<release_frame:
                    world=matrix@offsets[obj.name]
                    frozen[obj.name]=world.copy()
                else:
                    world=frozen[obj.name].copy()
            samples[obj.name].append(world)
    for obj in objects:
        obj.rotation_mode='QUATERNION'
        previous=None
        for frame,world in zip(range(scene.frame_start,scene.frame_end+1),samples[obj.name]):
            scene.frame_set(frame)
            obj.matrix_world=world
            if previous is not None and previous.dot(obj.rotation_quaternion)<0:
                obj.rotation_quaternion.negate()
            previous=obj.rotation_quaternion.copy()
            for path in ('location','rotation_quaternion','scale'):
                obj.keyframe_insert(path,frame=frame)
    for frame in range(grasp_frame,release_frame or (scene.frame_end+1)):
        scene.frame_set(frame);matrix=hand_matrix(rig,hand,bpy.context.evaluated_depsgraph_get())
        for obj in objects:
            expected=matrix@offsets[obj.name]
            maximum_position_error=max(maximum_position_error,(obj.matrix_world.translation-expected.translation).length)
            maximum_angle_error=max(maximum_angle_error,obj.matrix_world.to_quaternion().rotation_difference(expected.to_quaternion()).angle)
    if maximum_position_error>.0001 or maximum_angle_error>.001:
        raise ValueError('Baked object attachment failed evaluated transform validation')
    scene.frame_set(scene.frame_start)
    return {'hand':hand,'objects':[o.name for o in objects],'grasp_frame':grasp_frame,'release_frame':release_frame,'max_attachment_position_error_m':maximum_position_error,'max_attachment_angle_error_rad':maximum_angle_error,'finger_articulation_approved':False,'production_approved':False}
