"""Pose-space hand contact correction on retained linear-skinned geometry.

The contact shape is driven by the existing grip control, so it follows the
hand during pickup/hold/release. No bone lengths, prop geometry or other body
regions are altered. Native closed-volume collision QA remains mandatory.
"""
import bpy
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
from .facial import driver


def fit_hand_contact(scene,body,rig,prop,side,frame,max_correction=.012):
    arm=next(m for m in body.modifiers if m.type=='ARMATURE' and m.object==rig)
    if arm.use_deform_preserve_volume:raise ValueError('Contact fitting requires verified linear skinning')
    scene.frame_set(frame);bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();points=[];faces=[]
    for part in [prop]+list(prop.children_recursive):
        if part.type!='MESH' or part.hide_render:continue
        ev=part.evaluated_get(dep);mesh=ev.to_mesh();offset=len(points);points.extend(ev.matrix_world@v.co for v in mesh.vertices);faces.extend(tuple(offset+i for i in p.vertices) for p in mesh.polygons);ev.to_mesh_clear()
    if not points:raise ValueError('Contact prop has no visible mesh')
    edges={}
    for face in faces:
        for a,b in zip(face,face[1:]+face[:1]):key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
    if any(n!=2 for n in edges.values()):raise ValueError('Contact correction needs a closed prop surface')
    tree=BVHTree.FromPolygons(points,faces);direction=Vector((1,.371,.217)).normalized()
    def inside(point):
        origin=point.copy();hits=0
        for _ in range(64):
            hit,_,_,_=tree.ray_cast(origin,direction,10.)
            if hit is None:break
            hits+=1;origin=hit+direction*.000001
        return hits%2==1
    names={g.index:g.name for g in body.vertex_groups};selected=[]
    for vertex in body.data.vertices:
        if any(g.weight>.10 and (names[g.group]=='hand.'+side or (names[g.group].startswith('finger_') and names[g.group].endswith('.'+side))) for g in vertex.groups):selected.append(vertex.index)
    name='V025_contact_grip_'+side
    if body.data.shape_keys and name in body.data.shape_keys.key_blocks:raise ValueError('Contact correction already exists')
    if body.data.shape_keys is None:body.shape_key_add(name='Basis',from_mix=False)
    key=body.shape_key_add(name=name,from_mix=False);base=[v.co.copy() for v in key.data];key.value=1.
    bpy.context.view_layer.update();ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());maps={}
    for i in selected:
        deform=Matrix(((0,0,0),(0,0,0),(0,0,0)));mass=0.
        for group in body.data.vertices[i].groups:
            bone=ev.pose.bones.get(names[group.group])
            if bone is None or not bone.bone.use_deform:continue
            deform+=(bone.matrix@bone.bone.matrix_local.inverted()).to_3x3()*group.weight;mass+=group.weight
        if mass<.99:raise ValueError('Unnormalized hand skinning weights')
        world=ev.matrix_world.to_3x3()@deform@ev.matrix_world.inverted().to_3x3()@body.matrix_world.to_3x3();maps[i]=world.inverted()
    corrected=set();maximum=0.;remaining=0
    for iteration in range(4):
        body.update_tag();bpy.context.view_layer.update();evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();moves=[]
        for i in selected:
            point=evaluated.matrix_world@mesh.vertices[i].co;nearest,normal,_,distance=tree.find_nearest(point)
            if distance is None or distance>.025 or not inside(point):continue
            delta=nearest+normal*.0008-point;moves.append((i,maps[i]@delta));corrected.add(i)
        evaluated.to_mesh_clear();remaining=len(moves)
        if not moves:break
        for i,delta in moves:
            key.data[i].co+=delta;world_delta=maps[i].inverted()@(key.data[i].co-base[i]);maximum=max(maximum,world_delta.length)
            if world_delta.length>max_correction:raise ValueError('Contact correction exceeds local skin bound')
    prop_name='grip.'+side;peak=float(rig.get(prop_name,0))
    if peak<=0:raise ValueError('Contact pose has no grip activation')
    driver(key,'value',rig,prop_name,f'max(0,min(1,c/{peak}))')
    return {'control':prop_name,'control_peak':peak,'corrected_vertices':len(corrected),'max_world_correction_m':maximum,'iterations':iteration+1,'last_iteration_inside_count':remaining,'other_body_regions_preserved':True,'limb_lengths_preserved':True,'production_approved':False}
