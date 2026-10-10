"""Reusable asymmetric eye opening refinement on retained connected eyelids."""
import bpy,math
from mathutils import Vector
from .spec import FACE_PROFILES


def refine_eye_opening(code,upper=.62,lower=.46):
    report=[]
    for side,(cx,cz,w,h) in zip(('R','L'),FACE_PROFILES[code]['eyes']):
        lid=bpy.data.objects[code+'_EYELID.'+side]
        if lid.get('aperture_refined'):raise ValueError('Eye opening already refined')
        n=int(lid['ring_vertices']);keys=lid.data.shape_keys.key_blocks;original=[v.co.copy() for v in keys['Basis'].data];closed=[v.co.copy() for v in keys['blink'].data];rings=len(original)//n
        boundary=original[-n:];angles=[math.atan2((p.z-cz)/(h*1.7),(p.x-cx)/(w*1.6)) for p in boundary]
        for i,base in enumerate(original):
            f=(i//n)/(rings-1);u=f*f*(3-2*f);a=angles[i%n]
            new=base.copy();height=upper if math.sin(a)>0 else lower
            new.z+=(height-.78)*h*math.sin(a)*(1-u)
            for key in keys:
                if key.name=='blink':continue
                if key.name=='squint':key.data[i].co=new.lerp(closed[i],.27)
                elif key.name=='eye_wide':
                    key.data[i].co=new.copy();key.data[i].co.z+=(new.z-cz)*.12*(1-f)**2
                else:key.data[i].co+=new-base
        # Use the actual adjoining source skin around each angle, retaining
        # its local colour variation instead of a uniform cheek-colour disc.
        layer=lid.data.color_attributes['MasterSkin'];edge_colors={loop.vertex_index%n:Vector(layer.data[loop.index].color) for loop in lid.data.loops if loop.vertex_index>=len(original)-n}
        for loop in lid.data.loops:
            old=Vector(layer.data[loop.index].color);edge=edge_colors[loop.vertex_index%n]
            layer.data[loop.index].color=old*.25+edge*.75
        lid['aperture_refined']=True;lid['opening_upper_fraction']=upper;lid['opening_lower_fraction']=lower
        report.append({'side':side,'upper_fraction':upper,'lower_fraction':lower,'shared_outer_boundary_preserved':True,'closed_lid_pose_preserved':True,'production_approved':False})
    return report
