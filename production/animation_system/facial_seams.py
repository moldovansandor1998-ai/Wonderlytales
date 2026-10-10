"""Local eye-socket reconstruction on the retained character mesh.

Cuts a convex aperture through actual source triangles, retains UVs, skin
weights and shape-key layers, then gives the lid exactly the same boundary.
Broken/branched boundaries fail closed: they are never angle-sorted into a
visually plausible but disconnected overlay. All coordinates are bind-local.
"""
import math
import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree
from .facial import Surface, native_mesh, ring_faces, driver
from .repair_mark_seam import ordered_boundary
from .spec import FACE_PROFILES, smooth


def cut_aperture(body, centre, radii, depth_limit, crack_limit=.003):
    x, z = centre
    rx, rz = radii
    # Existing mouth correspondence must survive vertex-index changes.
    seams = []
    for obj in bpy.data.objects:
        if obj.get('seam_body') == body.name:
            seams.append((obj, [body.data.vertices[i].co.copy() for i in obj['seam_body_indices']]))
    bm = bmesh.new()
    bm.from_mesh(body.data)
    protected = {int(i) for obj,_ in seams for i in obj['seam_body_indices']}
    bm.verts.index_update()
    near = [v for v in bm.verts if v.index not in protected and abs(v.co.x-x)<rx*1.3 and abs(v.co.z-z)<rz*1.3 and v.co.y<depth_limit]
    bmesh.ops.remove_doubles(bm, verts=near, dist=.0003)
    planes = []
    for j in range(48):
        a = j*math.tau/48
        normal = Vector((math.cos(a)/rx, 0, math.sin(a)/rz))
        point = Vector((x+rx*math.cos(a), 0, z+rz*math.sin(a)))
        planes.append((normal, point))
        region = [f for f in bm.faces if any(((v.co.x-x)/(rx*1.2))**2+((v.co.z-z)/(rz*1.2))**2<1 and v.co.y<depth_limit for v in f.verts)]
        geom = set(region)
        for face in region:
            geom.update(face.verts)
            geom.update(face.edges)
        bmesh.ops.bisect_plane(bm, geom=list(geom), dist=1e-7, plane_co=point, plane_no=normal, use_snap_center=True)
    removed = {f for f in bm.faces if f.calc_center_median().y<depth_limit and all((f.calc_center_median()-p).dot(n)<1e-6 for n,p in planes)}
    edges = {e for e in bm.edges if any(f in removed for f in e.link_faces) and any(f not in removed for f in e.link_faces)}
    tag = bm.verts.layers.int.new('V025_local_cut')
    for edge in edges:
        for vertex in edge.verts:
            vertex[tag] = 1
    bmesh.ops.delete(bm, geom=list(removed), context='FACES')
    repairs = []
    try:
        while True:
            edges = {e for e in bm.edges if e.is_boundary and all(v[tag] for v in e.verts)}
            adjacent = {v: [e for e in edges if v in e.verts] for e in edges for v in e.verts}
            if any(len(es)>2 for es in adjacent.values()):
                raise ValueError('Branched source eye perimeter')
            ends = [v for v,es in adjacent.items() if len(es)==1]
            if not ends:
                break
            if len(ends)%2:
                raise ValueError('Odd source eye perimeter endpoints')
            a,b = min(((a,b) for i,a in enumerate(ends) for b in ends[i+1:]), key=lambda pair:(pair[0].co-pair[1].co).length)
            gap = (a.co-b.co).length
            if gap>crack_limit:
                raise ValueError(f'Eye perimeter crack {gap:.6f} exceeds {crack_limit:.6f}')
            repairs.append(gap)
            bmesh.ops.pointmerge(bm, verts=[a,b], merge_co=(a.co+b.co)*.5)
        boundary = ordered_boundary(edges)
        # A second disconnected rim is not silently dropped.
        if len(boundary)!=len(edges):
            raise ValueError('Multiple source layers at eye perimeter')
        winding = sum(math.atan2((a.co.x-x)*(b.co.z-z)-(a.co.z-z)*(b.co.x-x), (a.co.x-x)*(b.co.x-x)+(a.co.z-z)*(b.co.z-z)) for a,b in zip(boundary,boundary[1:]+boundary[:1]))/math.tau
        if abs(winding-1)>1e-5:
            raise ValueError('Eye perimeter does not enclose the eye')
        bm.verts.index_update()
        ids = [v.index for v in boundary]
        bm.verts.layers.int.remove(tag)
        bm.to_mesh(body.data)
    finally:
        bm.free()
    body.data.update()
    if seams:
        tree = KDTree(len(body.data.vertices))
        for vertex in body.data.vertices:
            tree.insert(vertex.co,vertex.index)
        tree.balance()
        for obj,points in seams:
            matches = [tree.find(point) for point in points]
            if max(q[2] for q in matches)>1e-6:
                raise ValueError(f'Eye cut changed {obj.name} seam by {max(q[2] for q in matches):.8f}')
            obj['seam_body_indices'] = [q[1] for q in matches]
    return ids, repairs


def regularize_perimeter(body, ids, centre, radii, limit=.002):
    """Minimal ordered angular correction; keep all native edge correspondences."""
    x,z=centre;rx,rz=radii
    original=np.array([body.data.vertices[i].co[:] for i in ids])
    angles=np.unwrap(np.arctan2((original[:,2]-z)/rz,(original[:,0]-x)/rx))
    epsilon=1e-4;blocks=[]
    for i,value in enumerate(angles-np.arange(len(ids))*epsilon):
        blocks.append([float(value),[i]])
        while len(blocks)>1 and blocks[-2][0]>blocks[-1][0]:
            b=blocks.pop();a=blocks.pop();indices=a[1]+b[1]
            blocks.append([(a[0]*len(a[1])+b[0]*len(b[1]))/len(indices),indices])
    ordered=np.empty(len(ids))
    for value,indices in blocks:ordered[indices]=value
    ordered+=np.arange(len(ids))*epsilon
    span=ordered[-1]-ordered[0]
    if span>=math.tau:ordered=ordered[0]+(ordered-ordered[0])*(math.tau-epsilon)/span
    rho=np.sqrt(((original[:,0]-x)/rx)**2+((original[:,2]-z)/rz)**2)
    boundary=original.copy();boundary[:,0]=x+rx*rho*np.cos(ordered);boundary[:,2]=z+rz*rho*np.sin(ordered)
    deltas=boundary-original;maximum=float(np.linalg.norm(deltas,axis=1).max())
    if maximum>limit:raise ValueError(f'Local perimeter correction {maximum:.6f} exceeds {limit}')
    for i,delta in zip(ids,deltas):
        delta=Vector(delta);body.data.vertices[i].co+=delta
        if body.data.shape_keys:
            for key in body.data.shape_keys.key_blocks:key.data[i].co+=delta
    body.data.update()
    return maximum


def repair_eyelid(scene, code, rig, body, side):
    # A newly created local skin needs its parent transform evaluated before
    # native_mesh derives the lid's bind transform from body.matrix_world.
    bpy.context.view_layer.update()
    x,z,w,h = FACE_PROFILES[code]['eyes'][('R','L').index(side)]
    old = bpy.data.objects[code+'_EYELID.'+side]
    surface = Surface(body)
    globe = rig.data.bones['eye.'+side].head_local.copy()
    oriented=body.get('facial_substrate',False)
    normal=Vector(body['eye_surface_normal']) if oriented else Vector((0,-1,0))
    horizontal=Vector((1,normal.x/max(1e-8,-normal.y),0)).normalized()
    vertical=normal.cross(horizontal).normalized()
    if not oriented:globe.y -= w*.03
    radius = w*.90
    rx,rz=(w*1.2,h*1.3) if body.get('facial_substrate') else (w*1.6,h*1.7)
    ids, repairs = cut_aperture(body,(x,z),(rx,rz),float('inf') if body.get('facial_substrate') else globe.y+.03)
    correction = regularize_perimeter(body,ids,(x,z),(rx,rz))
    edges = [body.data.vertices[i].co.copy() for i in ids]
    angles = [math.atan2((p.z-z)/rz,(p.x-x)/rx) for p in edges]
    steps = [(b-a+math.pi)%math.tau-math.pi for a,b in zip(angles,angles[1:]+angles[:1])]
    if min(steps)<-1e-5:
        raise ValueError(f'Non-radial source eye perimeter: minimum step {min(steps)}')
    bindings = [{body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[i].groups} for i in ids]
    body_keys = {key.name:[key.data[i].co.copy() for i in ids] for key in body.data.shape_keys.key_blocks} if body.data.shape_keys else {}
    n,rings = len(ids),12
    verts,closed,weights,colors = [],[],[],[]
    cheek = (surface.color(x-w*1.65,z,globe.y)+surface.color(x+w*1.65,z,globe.y))*.5
    for ring in range(rings):
        f = ring/(rings-1)
        u = smooth(f)
        for j,(edge,a) in enumerate(zip(edges,angles)):
            if oriented:
                ix=w*.78*math.cos(a);iz=h*(.48 if math.sin(a)>0 else .40)*math.sin(a)
                iz_closed=-.12*h*math.sin(a)**2
                def on_globe(lx,lz):
                    depth=math.sqrt(max(0,radius**2-lx**2-(lz*w/h)**2))+.0008
                    return globe+horizontal*lx+vertical*lz+normal*depth
                inner=on_globe(ix,iz);shut_inner=on_globe(ix,iz_closed)
                p=inner.lerp(edge,u);shut=shut_inner.lerp(edge,u)
            else:
                inner = Vector((x+w*.84*math.cos(a),globe.y,z+h*.78*math.sin(a)))
                p = inner.lerp(edge,u)
                shut_z = z-.12*h*math.sin(a)**2
                shut = p.copy()
                shut.z += (shut_z-inner.z)*(1-u)
                for point in (p,shut):
                    q = radius**2-(point.x-x)**2-((point.z-z)*w/h)**2
                    depth = globe.y-(math.sqrt(q) if q>0 else 0)-.0008
                    point.y = depth*(1-u)+edge.y*u
                    if q>0:point.y = min(point.y,depth)
            if ring==rings-1:
                p=edge.copy();shut=edge.copy()
            verts.append(p);closed.append(shut)
            blend=smooth(f/.7)
            binding={name:value*blend for name,value in bindings[j].items()}
            binding['head']=binding.get('head',0)+(1-blend)
            weights.append(binding)
            edge_color=surface.color(edge.x,edge.z,edge.y)
            colors.append(cheek*(1-u)+edge_color*u)
    mat=old.data.materials[0]
    lid=native_mesh(scene,rig,body,old.name+'_V025',verts,ring_faces(n,rings),mat,weights,colors)
    for modifier in lid.modifiers:
        if modifier.type=='ARMATURE':modifier.use_deform_preserve_volume=next((m.use_deform_preserve_volume for m in body.modifiers if m.type=='ARMATURE'),True)
    for collection in old.users_collection:
        if lid.name not in collection.objects:
            collection.objects.link(lid)
    name=old.name
    bpy.data.objects.remove(old,do_unlink=True)
    lid.name=name
    lid.shape_key_add(name='Basis')
    for name,amount,prop in [('blink',1.,'blink.'+side),('squint',.27,'squint')]:
        key=lid.shape_key_add(name=name)
        for v,a,b in zip(key.data,verts,closed):
            v.co=a.lerp(b,amount)
        driver(key,'value',rig,prop,'max(0,min(1,c))')
    key=lid.shape_key_add(name='eye_wide')
    for i,v in enumerate(key.data):
        f=(i//n)/(rings-1)
        v.co.z+=(v.co.z-z)*.12*(1-f)**2
    driver(key,'value',rig,'eye_wide','max(0,min(1,c))')
    for name,coords in body_keys.items():
        if name=='Basis':
            continue
        key=lid.shape_key_add(name=name)
        for i,v in enumerate(key.data):
            v.co+=(coords[i%n]-body_keys['Basis'][i%n])*smooth((i//n)/(rings-1))
        if name in rig:
            driver(key,'value',rig,name,'max(0,min(1,c))')
    lid['ring_vertices']=n
    lid['seam_body']=body.name
    lid['seam_body_indices']=ids
    lid['seam_patch_indices']=list(range((rings-1)*n,rings*n))
    lid['boundary_matched']=True
    lid['topology_revision']='V025_SHARED_SOURCE_PERIMETER'
    return {'character':code,'side':side,'boundary_vertices':n,'local_crack_merges_m':repairs,'perimeter_correction_m':correction,'production_approved':False}
