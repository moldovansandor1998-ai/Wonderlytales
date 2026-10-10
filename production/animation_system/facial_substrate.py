"""Local anatomical skin support beneath retained fragmented fur.

Each eye owns a continuous textured skin disc derived from nearby source
geometry. Its perimeter recedes under the original fur; the eyelid shares real
cut edges with the skin, with no rectangular surface or replacement character.
"""
import bpy,bmesh,math,numpy as np
from mathutils import Vector
from .facial import Surface,native_mesh,material,cut_surface
from .spec import FACE_PROFILES,smooth


def create_eye_substrate(scene,body,rig,code,side):
    surface=Surface(body);x,z,w,h=FACE_PROFILES[code]['eyes'][('R','L').index(side)]
    centre=rig.data.bones['eye.'+side].head_local;rx=w*1.75;rz=h*1.8
    samples=[]
    def features(dx,dz):return np.array([1,dx,dz,dx*dx,dx*dz,dz*dz])
    for radius in (1.45,1.8,2.2):
        for j in range(96):
            a=j*math.tau/96;dx=w*radius*math.cos(a);dz=h*radius*math.sin(a)
            p,_,_,_=surface.tree.ray_cast(Vector((x+dx,-3,z+dz)),Vector((0,1,0)))
            if p is not None and abs(p.y-centre.y)<.12:samples.append((dx,dz,p.y))
    a=np.array([features(dx,dz) for dx,dz,_ in samples]);values=np.array([y for _,_,y in samples]);mask=np.ones(len(a),dtype=bool)
    for _ in range(5):
        coeff=np.linalg.lstsq(a[mask],values[mask],rcond=None)[0];residual=np.abs(a@coeff-values)
        mask=residual<max(.005,float(np.median(residual))*2.5)
    # Infer the eye's anatomical depth from the intact surrounding cheek.
    # The old cap-derived pivot can sit behind the skin when a source eye
    # aperture made the original front-ray hit the back of the head.
    surface_normal=Vector((float(coeff[1]),-1,float(coeff[2]))).normalized()
    original_centre=centre.copy()
    desired=Vector((x,float(coeff[0]),z))-surface_normal*(w*.68)
    rotation=Vector((0,-1,0)).rotation_difference(surface_normal)
    shift=desired-original_centre
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.object.mode_set(mode='EDIT');bone=rig.data.edit_bones['eye.'+side];length=bone.length;bone.head=desired;bone.tail=desired+surface_normal*length;bpy.ops.object.mode_set(mode='OBJECT')
    for label in ('EYEBALL','IRIS','PUPIL'):
        eye=bpy.data.objects[code+'_'+label+'.'+side]
        for vertex in eye.data.vertices:vertex.co=desired+rotation@(vertex.co-original_centre)
        if eye.data.shape_keys:
            for key in eye.data.shape_keys.key_blocks:
                for vertex in key.data:vertex.co=desired+rotation@(vertex.co-original_centre)
    centre=rig.data.bones['eye.'+side].head_local
    n=128;rings=24;vertices=[];colors=[]
    for k in range(rings):
        f=(k+1)/rings
        for j in range(n):
            angle=j*math.tau/n;dx=rx*f*math.cos(angle);dz=rz*f*math.sin(angle)
            predicted=float(features(dx,dz)@coeff)
            p,_=surface.hit(x+dx,z+dz,predicted)
            # Recede at the outer rim to keep the retained fur silhouette.
            edge_weight=smooth((f-.74)/.26)
            depth=predicted*(1-edge_weight)+(p.y+.006)*edge_weight
            vertices.append((x+dx,depth,z+dz));colors.append(surface.color(x+dx,z+dz,predicted))
    faces=[(k*n+j,(k+1)*n+j,(k+1)*n+(j+1)%n,k*n+(j+1)%n) for k in range(rings-1) for j in range(n)]
    faces.append(tuple(reversed(range(n))))
    mat=material(code+' V025 local underfur skin '+side,(1,1,1),.78,True)
    obj=native_mesh(scene,rig,body,code+'_V025_EYE_SKIN.'+side,vertices,faces,mat,colors=colors)
    obj.data.uv_layers.new(name='UVMap');obj['facial_substrate']=True;obj['eye_surface_normal']=list(surface_normal);obj['source_body']=body.name;obj['production_approved']=False
    # Remove old fur triangles only inside the new eye aperture. The retained
    # outer fur cards sit over the recessed continuous skin perimeter.
    removed=clip_fur_aperture(body,x,z,w*1.19,h*1.29,centre.y+.075)
    return obj,{'side':side,'eye_centre_correction_m':list(shift),'eye_surface_normal':list(surface_normal),'fit_samples':len(samples),'fit_inliers':int(mask.sum()),'fit_median_error_m':float(np.median(residual)),'skin_vertices':len(vertices),'old_aperture_faces_removed':removed,'original_character_retained':True,'production_approved':False}


def clip_fur_aperture(body,x,z,rx,rz,depth):
    """Clip retained fur cards at the aperture, preserving their outer portions."""
    bm=bmesh.new();bm.from_mesh(body.data);planes=[]
    for j in range(48):
        a=j*math.tau/48;normal=Vector((math.cos(a)/rx,0,math.sin(a)/rz));point=Vector((x+rx*math.cos(a),0,z+rz*math.sin(a)))
        planes.append((normal,point))
        region=[f for f in bm.faces if any(((v.co.x-x)/(rx*1.2))**2+((v.co.z-z)/(rz*1.2))**2<1 and v.co.y<depth for v in f.verts)]
        geometry=set(region)
        for face in region:geometry.update(face.verts);geometry.update(face.edges)
        bmesh.ops.bisect_plane(bm,geom=list(geometry),dist=1e-7,plane_co=point,plane_no=normal,use_snap_center=True)
    removed=[f for f in bm.faces if f.calc_center_median().y<depth and all((f.calc_center_median()-p).dot(n)<1e-6 for n,p in planes)]
    count=len(removed);bmesh.ops.delete(bm,geom=removed,context='FACES_ONLY');bm.to_mesh(body.data);bm.free();body.data.update()
    return count
