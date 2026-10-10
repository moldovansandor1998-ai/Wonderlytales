"""Continuous oral skin binding under retained fur, preserving native visemes."""
import bpy,math
from mathutils import Vector
from .facial import Surface,native_mesh,ring_faces,driver,material
from .spec import FACE_PROFILES,smooth


def connect_oral_skin(scene,code,rig,body):
    patch=bpy.data.objects[code+'_FACIAL_TOPOLOGY']
    if patch.get('seam_body'):return {'existing_shared_boundary_preserved':True}
    surface=Surface(body);n=int(patch['ring_vertices']);ids=list(range(len(patch.data.vertices)-n,len(patch.data.vertices)))
    boundary=[patch.data.vertices[i].co.copy() for i in ids];cx,cz,w,h=FACE_PROFILES[code]['mouth']
    layer=patch.data.color_attributes['MasterSkin'];patch_colors={loop.vertex_index:Vector(layer.data[loop.index].color[:3]) for loop in patch.data.loops}
    rings=8;verts=[];weights=[];colors=[]
    for k in range(rings):
        u=smooth(k/(rings-1))
        for j,edge in enumerate(boundary):
            angle=math.atan2((edge.z-cz)/h,(edge.x-cx)/w)
            x=cx+w*3.1*math.cos(angle);z=cz+h*2.5*math.sin(angle)
            target,_=surface.hit(x,z,edge.y);target=Vector((x,target.y+.004,z))
            point=edge.lerp(target,u);verts.append(point)
            inner={patch.vertex_groups[g.group].name:g.weight for g in patch.data.vertices[ids[j]].groups}
            outer=surface.weights(x,z,target.y);binding={name:value*(1-u) for name,value in inner.items()}
            for name,value in outer.items():binding[name]=binding.get(name,0)+value*u
            weights.append(binding);colors.append(patch_colors[ids[j]]*(1-u)+Vector(surface.color(x,z,target.y))*u)
    mat=material(code+' V025 continuous oral skin',(1,1,1),.74,True)
    skin=native_mesh(scene,rig,body,code+'_ORAL_SKIN_V025',verts,ring_faces(n,rings),mat,weights,colors);skin.data.uv_layers.new(name='UVMap')
    for mod in skin.modifiers:
        if mod.type=='ARMATURE':mod.use_deform_preserve_volume=next(m.use_deform_preserve_volume for m in patch.modifiers if m.type=='ARMATURE')
    skin.shape_key_add(name='Basis')
    if patch.data.shape_keys:
        base=patch.data.shape_keys.key_blocks['Basis']
        for original in patch.data.shape_keys.key_blocks:
            if original.name=='Basis':continue
            key=skin.shape_key_add(name=original.name)
            for k in range(rings):
                for j,i in enumerate(ids):key.data[k*n+j].co+=(original.data[i].co-base.data[i].co)*(1-smooth(k/(rings-1)))
            if original.name in rig:driver(key,'value',rig,original.name,'max(0,min(1,c))')
    patch['seam_body']=skin.name;patch['seam_body_indices']=list(range(n));patch['seam_patch_indices']=ids;patch['boundary_matched']=True;patch['topology_revision']='V025_CONNECTED_ORAL_SKIN'
    skin['source_character_body']=body.name;skin['production_approved']=False
    return {'shared_native_boundary_vertices':n,'original_visemes_preserved':True,'original_oral_interior_preserved':True,'production_approved':False}
