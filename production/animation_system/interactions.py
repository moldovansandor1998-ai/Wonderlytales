"""Evaluated hand contacts, baked after body support; no limb stretching."""
import bpy,math
from mathutils import Vector
from .spec import smooth,QUADRUPEDS
from .facial import driver
from .hand_rig import contact_point

def restore_hand_drivers(rig):
    restored=[]
    for side in ('L','R'):
        bone=rig.pose.bones.get('forearm.'+side)
        if not bone:continue
        constraint=bone.constraints.get('Master hand contact')
        if not constraint:continue
        prop='ik_hand.'+side
        if prop not in rig:rig[prop]=0.
        driver(constraint,'influence',rig,prop,'max(0,min(1,c))')
        restored.append(side)
    return restored

def author_interactions(scene,script,rigs):
    report=[];count=round(script['duration']*24)
    for rig in rigs.values():restore_hand_drivers(rig)
    for event in script.get('interactions',[]):
        code=event['character'];rig=rigs[code];side=event.get('hand','R')
        if code in QUADRUPEDS:raise ValueError('Quadruped pickup needs a mouth attachment')
        identity='PROP_'+event['id'];old=bpy.data.objects.get(identity)
        if old:bpy.data.objects.remove(old,do_unlink=True)
        target=Vector(event['position']);start=round(event['start']*24)+1;end=min(count,round(event['end']*24))
        grasp=round((event['start']+(event['end']-event['start'])*.55)*24)+1
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=event.get('radius',.06),location=target)
        prop=bpy.context.object;prop.name=identity
        # Explicit pre-grasp keys prevent Blender extrapolating the first held
        # position backwards through the entire scene.
        prop.keyframe_insert('location',frame=1);prop.keyframe_insert('location',frame=grasp-1)
        path='["ik_hand.'+side+'"]';rig['ik_hand.'+side]=0
        rig.keyframe_insert(path,frame=1);rig.keyframe_insert(path,frame=max(1,start-1));rig.keyframe_insert(path,frame=min(count,end+1))
        hand_name='hand.'+side;control=rig.pose.bones['CTRL_hand.'+side];landmark=event.get('contact_landmark_local')
        for frame in range(start,end+1):
            scene.frame_set(frame);u=((frame-1)/24-event['start'])/(event['end']-event['start'])
            influence=smooth(u/.2)*(1-smooth((u-.85)/.15))
            # The two-bone IK reaches the wrist, whereas the grasp point is at
            # the end of the hand. Solve that offset at full influence, then
            # restore the authored approach/release envelope.
            rig['ik_hand.'+side]=1.;rig.update_tag();bpy.context.view_layer.update()
            ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());hand=ev.pose.bones[hand_name]
            wrist=target-(contact_point(ev,side,landmark)-ev.matrix_world@hand.head)
            for _ in range(8):
                control.location=control.bone.matrix_local.inverted()@(rig.matrix_world.inverted()@wrist)
                rig.update_tag();bpy.context.view_layer.update();ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
                delta=target-contact_point(ev,side,landmark)
                if delta.length<.001:break
                wrist+=delta
            control.keyframe_insert('location',frame=frame)
            rig['ik_hand.'+side]=influence;rig.keyframe_insert(path,frame=frame)
        carry_end=count if event.get('carry_to_end') else end
        distances=[];handoff=None
        if event['kind']=='pickup':
            for frame in range(grasp,carry_end+1):
                scene.frame_set(frame);rig.update_tag();bpy.context.view_layer.update()
                ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());point=contact_point(ev,side,landmark)
                if frame==grasp:handoff=(point-target).length
                prop.location=point;prop.keyframe_insert('location',frame=frame);distances.append((prop.location-point).length)
        if prop.animation_data:
            for curve in prop.animation_data.action.fcurves:
                for key in curve.keyframe_points:key.interpolation='LINEAR'
        report.append({'id':event['id'],'grasp_frame':grasp,'handoff_error_m':handoff,'max_baked_attachment_error_m':max(distances,default=0),'grasp_contact_pass':handoff is not None and handoff<.02,'contact_landmark_local':landmark,'finger_articulation_approved':False})
    return report
