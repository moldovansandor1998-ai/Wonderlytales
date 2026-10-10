"""Orient deep biped bends forward while keeping world-space foot targets.

The nearly straight bind pose cannot identify a reliable knee plane. Calibrate
it at the authored crouch and blend the pole angle with the lowering envelope.
"""
import bpy,math
from mathutils import Vector
from .motion import support_shift
from .spec import QUADRUPEDS

def orient_crouch_knees(scene,script,rigs):
    report=[]
    if not script.get('orient_crouch_knees'):return report
    for actor in script['characters']:
        if actor['code'] in QUADRUPEDS:continue
        rig=rigs[actor['code']]
        for action in actor.get('actions',[]):
            if action['clip']!='pickup' or action.get('body_lower',0)<.1:continue
            sample=round((action['start']+action['end'])/2*24)+1;scene.frame_set(sample)
            for side in ('L','R'):
                upper='thigh.'+side;lower='shin.'+side
                con=next(c for c in rig.pose.bones[lower].constraints if c.type=='IK')
                original=float(con.pole_angle);best=(-2.,original)
                for step in range(64):
                    con.pole_angle=-math.pi+step*math.tau/64;rig.update_tag();bpy.context.view_layer.update()
                    ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());hip=ev.matrix_world@ev.pose.bones[upper].head;knee=ev.matrix_world@ev.pose.bones[upper].tail;ankle=ev.matrix_world@ev.pose.bones[lower].tail
                    axis=(ankle-hip).normalized();bend=knee-hip;bend-=axis*bend.dot(axis)
                    forward=ev.matrix_world.to_quaternion()@Vector((0,-1,0));forward-=axis*forward.dot(axis)
                    score=bend.normalized().dot(forward.normalized())
                    if score>best[0]:best=(score,float(con.pole_angle))
                angle=(best[1]-original+math.pi)%math.tau-math.pi
                con.pole_angle=original;con.keyframe_insert('pole_angle',frame=1)
                for frame in range(round(action['start']*24)+1,round(action['end']*24)+2):
                    amount=max(0,min(1,-support_shift(actor,(frame-1)/24)[2]/action['body_lower']))
                    con.pole_angle=original+angle*amount;con.keyframe_insert('pole_angle',frame=frame)
                report.append({'character':actor['code'],'side':side,'sample_frame':sample,'forward_alignment':best[0],'original_angle':original,'crouch_angle':original+angle,'foot_targets_changed':False})
    return report
