"""Short native fur on repaired skin, driven by the same facial shape keys."""
import bpy,random
from mathutils import Vector
from .facial import native_mesh,material,driver


def add_lid_fur(scene,rig,lid,seed=25025):
    name=lid.name+'_V025_FUR'
    if bpy.data.objects.get(name):raise ValueError('Facial fur already exists')
    n=int(lid['ring_vertices']);rng=random.Random(seed);vertices=[];faces=[];weights=[];colors=[];anchors=[]
    layer=lid.data.color_attributes['MasterSkin'];palette={p.vertex_index:Vector(layer.data[p.index].color[:3]) for p in lid.data.loops}
    for polygon in lid.data.polygons:
        ids=list(polygon.vertices)
        if min(ids)//n<3:continue
        corners=[lid.data.vertices[i].co for i in ids];base=sum(corners,Vector())/len(corners)
        normal=(corners[1]-corners[0]).cross(corners[2]-corners[0]).normalized()
        outward=((corners[1]+corners[2])-(corners[0]+corners[3])).normalized()
        cross=normal.cross(outward).normalized();length=rng.uniform(.0018,.0038);width=rng.uniform(.00035,.0007)
        binding={}
        for i in ids:
            for group in lid.data.vertices[i].groups:
                key=lid.vertex_groups[group.group].name;binding[key]=binding.get(key,0)+group.weight/len(ids)
        color=sum((palette[i] for i in ids),Vector())/len(ids)*rng.uniform(.86,1.10)
        start=len(vertices)
        for point in (base-cross*width,base+cross*width,base+outward*length+normal*length*.45):
            vertices.append(point);weights.append(binding);colors.append(color);anchors.append(ids)
        faces.append((start,start+1,start+2))
    fur=native_mesh(scene,rig,lid,name,vertices,faces,material(name,(1,1,1),.82,True),weights,colors)
    for mod in fur.modifiers:
        if mod.type=='ARMATURE':mod.use_deform_preserve_volume=next(m.use_deform_preserve_volume for m in lid.modifiers if m.type=='ARMATURE')
    fur.shape_key_add(name='Basis')
    if lid.data.shape_keys:
        base=lid.data.shape_keys.key_blocks['Basis']
        for original in lid.data.shape_keys.key_blocks:
            if original.name=='Basis':continue
            key=fur.shape_key_add(name=original.name)
            for point,ids in zip(key.data,anchors):point.co+=sum((original.data[i].co-base.data[i].co for i in ids),Vector())/len(ids)
            prop='blink.'+lid.name[-1] if original.name=='blink' else original.name
            if prop in rig:driver(key,'value',rig,prop,'max(0,min(1,c))')
    fur['production_approved']=False
    return {'triangular_fur_tufts':len(faces),'same_native_skin_weights':True,'same_facial_shape_keys':True,'production_approved':False}
