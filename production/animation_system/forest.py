"""Reusable native forest detail and restrained cinematic camera finishing.

Adds small terrain-bound details using retained forest geometry. Existing
location assets and shot endpoints are preserved; this is an opt-in candidate.
"""
import math,random
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from .spec import smooth


def finish_forest(scene, bounds, seed=25025, count=240):
    if bpy.data.collections.get('V025_FOREST_DETAILS'):
        raise ValueError('Forest detail pass already exists')
    ground=[o for o in scene.objects if o.type=='MESH' and not o.hide_render and any(k in o.name.lower() for k in ('forest floor','forest path','woodland terrain'))]
    if not ground:raise ValueError('Existing native forest ground not found')
    vertices=[];faces=[]
    for obj in ground:
        start=len(vertices)
        vertices += [obj.matrix_world@v.co for v in obj.data.vertices]
        faces += [tuple(start+i for i in p.vertices) for p in obj.data.polygons]
    terrain=BVHTree.FromPolygons(vertices,faces)
    collection=bpy.data.collections.new('V025_FOREST_DETAILS');scene.collection.children.link(collection)
    rng=random.Random(seed);verts=[];polys=[];indices=[];placed=0
    colors=[(.16,.075,.018,1),(.25,.13,.036,1),(.08,.13,.027,1),(.32,.17,.048,1)]
    for _ in range(count):
        x=rng.uniform(bounds[0],bounds[1]);y=rng.uniform(bounds[2],bounds[3])
        hit,normal,_,_=terrain.ray_cast(Vector((x,y,20)),Vector((0,0,-1)))
        if hit is None:continue
        angle=rng.random()*math.tau;size=rng.uniform(.018,.045);width=size*rng.uniform(.35,.60)
        forward=Vector((math.cos(angle),math.sin(angle),0));forward=(forward-normal*forward.dot(normal)).normalized();side=normal.cross(forward)
        local=[(-1,0,0),(-.45,-.7,.025),(.25,-1,.06),(1,0,.12),(.25,1,.06),(-.45,.7,.025),(0,0,.10)]
        start=len(verts)
        verts += [hit+normal*(.001+c*size)+forward*(a*size)+side*(b*width) for a,b,c in local]
        polys += [(start+i,start+(i+1)%6,start+6) for i in range(6)]
        indices += [rng.randrange(len(colors))]*6;placed+=1
    data=bpy.data.meshes.new('Terrain-bound leaf litter');data.from_pydata(verts,[],polys)
    obj=bpy.data.objects.new(data.name,data);collection.objects.link(obj)
    for i,color in enumerate(colors):
        mat=bpy.data.materials.new('V025 forest litter '+str(i));mat.use_nodes=True;p=mat.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=color;p.inputs['Roughness'].default_value=.82;data.materials.append(mat)
    for face,index in zip(data.polygons,indices):face.material_index=index;face.use_smooth=True
    for name,location,power,color,size in [('V025 soft warm key',(-3,-4,7),330,(1.,.78,.58),5.),('V025 canopy fill',(3,0,6),100,(.65,.78,1.),6.),('V025 warm rim',(1,4,6),460,(1.,.72,.43),3.5)]:
        light=bpy.data.lights.new(name,'AREA');light.energy=power;light.color=color;light.shape='DISK';light.size=size
        obj=bpy.data.objects.new(name,light);collection.objects.link(obj);obj.location=location;target=Vector(((bounds[0]+bounds[1])*.5,(bounds[2]+bounds[3])*.5,1.));obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    return {'existing_ground_objects':[o.name for o in ground],'terrain_bound_leaves':placed,'seed':seed,'production_approved':False}


def finish_cameras(scene, shots, duration):
    markers=sorted(scene.timeline_markers,key=lambda m:m.frame)
    if len(markers)!=len(shots):raise ValueError('Shot camera contract mismatch')
    for i,(marker,shot) in enumerate(zip(markers,shots)):
        camera=marker.camera;start=round(shot['start']*24)+1;end=round((shots[i+1]['start'] if i+1<len(shots) else duration)*24)
        a=Vector(shot['position']);b=Vector(shot.get('end_position',shot['position']));target_a=Vector(shot['target']);target_b=Vector(shot.get('end_target',shot['target']))
        forward=target_a-a;side=forward.cross(Vector((0,0,1))).normalized()
        # A shallow arc gives real foreground parallax while keeping both
        # endpoints and the original camera target composition intact.
        amplitude=min(.055,(b-a).length*.18)
        for frame in range(start,end+1):
            u=smooth((frame-start)/max(1,end-start));target=target_a.lerp(target_b,u)
            camera.location=a.lerp(b,u)+side*(amplitude*math.sin(math.pi*u)**2)
            camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
            camera.data.dof.use_dof=True;camera.data.dof.aperture_fstop=6.3
            camera.data.dof.focus_distance=(target-camera.location).length
            camera.keyframe_insert('location',frame=frame);camera.keyframe_insert('rotation_euler',frame=frame);camera.data.keyframe_insert('dof.focus_distance',frame=frame)
    return {'shots':len(shots),'original_endpoints_preserved':True,'maximum_arc_m':.055,'aperture_fstop':6.3,'production_approved':False}
