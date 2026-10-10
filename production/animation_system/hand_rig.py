"""Add articulated digits to retained hand geometry, using candidate bind landmarks.

No mesh replacement. Only the local hand's existing deform mass is redistributed.
Other characters must supply their own reviewed landmark profile; human hand
coordinates must never be transplanted to a quadruped or a different asset.
"""
import bpy,math
from mathutils import Vector
from .spec import smooth
from .facial import driver

MARK_RIGHT={
 'thumb':((-0.186,-0.075,0.400),(-0.184,-0.102,0.382),(-0.185,-0.112,0.367)),
 'index':((-0.197,-0.099,0.386),(-0.195,-0.116,0.365),(-0.198,-0.125,0.345)),
 'middle':((-0.206,-0.098,0.386),(-0.207,-0.117,0.360),(-0.209,-0.124,0.338)),
 'ring':((-0.216,-0.092,0.390),(-0.219,-0.109,0.366),(-0.224,-0.114,0.343)),
 'little':((-0.224,-0.081,0.392),(-0.231,-0.096,0.371),(-0.232,-0.101,0.353)),
}


def segment_distance(point,a,b):
    axis=b-a;u=max(0,min(1,(point-a).dot(axis)/max(axis.length_squared,1e-12)))
    return (point-a-axis*u).length


def add_digits(body,rig,side,landmarks):
    if rig.pose.bones.get('finger_index_01.'+side):raise ValueError('Digit rig already installed')
    hand=rig.data.bones['hand.'+side]
    measured=[v.co for v in body.data.vertices if any(body.vertex_groups[g.group].name=='hand.'+side and g.weight>.8 for g in v.groups)]
    for digit,points in landmarks.items():
        for point in points:
            if min((v-Vector(point)).length for v in measured)>.018:
                raise ValueError('Digit landmark is not near the retained hand: '+digit)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    segments=[]
    for digit,points in landmarks.items():
        parent=rig.data.edit_bones['hand.'+side]
        for i,(a,b) in enumerate(zip(points,points[1:])):
            name='finger_'+digit+'_'+str(i+1).zfill(2)+'.'+side
            bone=rig.data.edit_bones.new(name);bone.head=a;bone.tail=b;bone.parent=parent;bone.use_deform=True;parent=bone
            segments.append((name,Vector(a),Vector(b)))
    bpy.ops.object.mode_set(mode='OBJECT')
    prop='grip.'+side;rig[prop]=0.;rig.id_properties_ui(prop).update(min=0.,max=1.)
    for name,_,_ in segments:
        bone=rig.pose.bones[name];bone.rotation_mode='XYZ'
        # Small closure from the source's already relaxed finger pose.
        amount=.22 if 'thumb' in name else (.38 if '_01.' in name else .30)
        driver(bone,'rotation_euler',rig,prop,f'max(0,min(1,c))*{amount}',0)
    groups={name:body.vertex_groups.new(name=name) for name,_,_ in segments}
    changed=0;max_digit_mass=0.;rebound=0
    deform={bone.name for bone in rig.data.bones if bone.use_deform}
    hand_group=body.vertex_groups['hand.'+side]
    palm_y=max(p[1] for points in landmarks.values() for p in points)+.035
    for vertex in body.data.vertices:
        old=next((g.weight for g in vertex.groups if g.group==hand_group.index),0.)
        if old<.15:continue
        envelope=smooth((.425-vertex.co.z)/.015)*smooth((abs(vertex.co.x)-.17)/.01)*smooth((palm_y-vertex.co.y)/.01)
        if envelope>0:
            source=[(body.vertex_groups[g.group],g.weight) for g in vertex.groups if body.vertex_groups[g.group].name in deform]
            mass=sum(weight for _,weight in source)
            for group,weight in source:group.add([vertex.index],weight*(1-envelope),'REPLACE')
            old=old*(1-envelope)+mass*envelope;hand_group.add([vertex.index],old,'REPLACE');rebound+=1
        distances=[segment_distance(vertex.co,a,b) for _,a,b in segments]
        nearest=min(distances)
        influence=(1-smooth((nearest-.005)/.015))*smooth((.411-vertex.co.z)/.032)
        if influence<=0:continue
        mass=old*influence;raw=[(d+.003)**-6 for d in distances];total=sum(raw)
        hand_group.add([vertex.index],old-mass,'REPLACE')
        for (name,_,_),weight in zip(segments,raw):groups[name].add([vertex.index],mass*weight/total,'REPLACE')
        changed+=1;max_digit_mass=max(max_digit_mass,mass)
    return {'side':side,'digit_bones':len(segments),'reweighted_vertices':changed,'hand_transition_vertices':rebound,'max_digit_mass':max_digit_mass,'geometry_replaced':False,'landmark_proximity_limit_m':.018,'finger_articulation_approved':False}


def bake_grip(scene,rig,side,grasp_frame,release_frame=None,strength=.75):
    prop='grip.'+side
    if prop not in rig:raise ValueError('Articulated hand is missing')
    for frame in range(scene.frame_start,scene.frame_end+1):
        value=smooth((frame-(grasp_frame-10))/10)*strength
        if release_frame is not None:value*=1-smooth((frame-release_frame+6)/6)
        rig[prop]=float(value);rig.keyframe_insert('["'+prop+'"]',frame=frame)
    scene.frame_set(scene.frame_start)


def contact_point(evaluated_rig,side,landmark=None):
    hand=evaluated_rig.pose.bones['hand.'+side]
    if landmark is None:return evaluated_rig.matrix_world@hand.tail
    return evaluated_rig.matrix_world@hand.matrix@hand.bone.matrix_local.inverted()@Vector(landmark)
