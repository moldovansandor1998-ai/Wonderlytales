"""Reusable locomotion on generated Rigify controls, in metres at 24 fps.
The authored root path and each foot's contact interval share one distance clock.
Contact samples are checked in evaluated world space, not inferred from keyframes.
"""
import math
from mathutils import Vector, Matrix


def arm_direction(rig,side,direction):
    pb=rig.pose.bones['upper_arm_fk.'+side];basis=pb.bone.matrix_local.to_3x3()
    rest=(pb.bone.tail_local-pb.bone.head_local).normalized()
    pb.rotation_euler=(basis.inverted()@rest.rotation_difference(Vector(direction).normalized()).to_matrix()@basis).to_euler('XYZ')


def pose_position(pb,location):
    m=pb.matrix.copy();m.translation=Vector(location);pb.matrix=m


def key(pb,frame,rotation=True):
    pb.keyframe_insert('location',frame=frame)
    if rotation:pb.keyframe_insert('rotation_euler',frame=frame)


def locomotion(rig,frame,elapsed,distance,speed,mode='walk',phase_offset=0):
    """Positive distance moves down -Y. Stance tracks absolute travelled distance."""
    running=mode=='run';stride=.72 if running else .48;duty=.46 if running else .62
    cycle=distance/stride+phase_offset
    for side,offset,sign in [('L',0,1),('R',.5,-1)]:
        phase=(cycle+offset)%1
        foot=rig.pose.bones['foot_ik.'+side];base=foot.bone.head_local.copy()
        rig.pose.bones['thigh_parent.'+side]['IK_Stretch']=0.0
        if speed>.01:
            if phase<duty:
                y=stride*(phase-duty/2);z=0
            else:
                u=(phase-duty)/(1-duty);smooth=u*u*(3-2*u)
                y=stride*(duty/2-duty*smooth);z=(.14 if running else .067)*math.sin(math.pi*u)
            # cycle is world-distance based; compensate scale in the local rig.
            base.y+=y/rig.scale.x;base.z+=z/rig.scale.x
        pose_position(foot,base);key(foot,frame)
        swing=math.sin(math.tau*(cycle+offset))*(.29 if running else .15) if speed>.01 else 0
        arm_direction(rig,side,(sign*.10,swing,-.38))
        rig.pose.bones['forearm_fk.'+side].rotation_euler.x=-.7 if running else -.13
        for name in ['upper_arm_fk.','forearm_fk.','hand_fk.']:key(rig.pose.bones[name+side],frame)
    torso=rig.pose.bones['torso'];torso.location.z=(-.013+.015*math.cos(cycle*math.tau*2)) if speed>.01 else .002*math.sin(elapsed*2.4)
    torso.rotation_euler.x=.10 if running else .01
    key(torso,frame)
    rig.keyframe_insert('location',frame=frame);rig.keyframe_insert('rotation_euler',frame=frame)
    return cycle


def expression(code,frame,t,objects,emotion='neutral'):
    # Explicit blink gesture, not a camera-facing image animation.
    period={'MIRA':3.9,'BRUNO':5.2,'KIPP':2.9}[code];p=(t+.7)%period
    blink=max(0,1-abs(p-.15)/.085) if p<.3 else 0
    for side in ['L','R']:
        lid=objects[code+'_lid_'+side].data.shape_keys.key_blocks['blink'];lid.value=blink;lid.keyframe_insert('value',frame=frame)
    mouth=objects[code+'_ORAL_RING'].data.shape_keys.key_blocks
    mouth['mouthSmile'].value=.22 if emotion=='relief' else 0
    mouth['mouthFrown'].value=.25 if emotion=='fear' else 0
    for n in ['mouthSmile','mouthFrown']:mouth[n].keyframe_insert('value',frame=frame)
