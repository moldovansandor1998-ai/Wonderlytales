"""Keep interpolated eyelid surfaces outside their native eye globe."""
import bpy


def conform_lids(scene,rigs):
    report=[]
    # Matching weights also require the same skinning method at a shared seam.
    for patch in scene.objects:
        body=bpy.data.objects.get(patch.get('seam_body',''))
        if not body:continue
        source=next((m for m in body.modifiers if m.type=='ARMATURE'),None)
        if source:
            for modifier in patch.modifiers:
                if modifier.type=='ARMATURE':modifier.use_deform_preserve_volume=source.use_deform_preserve_volume
    for code in rigs:
        for side in ('R','L'):
            lid=bpy.data.objects.get(code+'_EYELID.'+side);globe=bpy.data.objects.get(code+'_EYEBALL.'+side)
            if lid is None or globe is None:continue
            if lid.modifiers.get('V025 eyelid globe clearance'):raise ValueError('Clearance already exists')
            n=int(lid['ring_vertices']);count=len(lid.data.vertices);group=lid.vertex_groups.new(name='V025 globe clearance')
            group.add(list(range(count-n)),1.,'REPLACE')
            modifier=lid.modifiers.new('V025 eyelid globe clearance','SHRINKWRAP');modifier.target=globe;modifier.wrap_method='NEAREST_SURFACEPOINT';modifier.wrap_mode='OUTSIDE';modifier.offset=.0008;modifier.vertex_group=group.name
            # The iris/pupil caps themselves sit above the globe. A second,
            # strictly local anterior projection keeps the closing lip above
            # those caps too; the source-connected outer seam remains free.
            anterior=lid.vertex_groups.new(name='V025 anterior lid')
            for ring,weight in enumerate((1.,1.,1.,.75,.5,.25)):
                anterior.add(list(range(ring*n,(ring+1)*n)),weight,'REPLACE')
            modifier=lid.modifiers.new('V025 eyelid cap clearance','SHRINKWRAP');modifier.target=globe;modifier.wrap_method='NEAREST_SURFACEPOINT';modifier.wrap_mode='OUTSIDE_SURFACE';modifier.offset=.002;modifier.vertex_group=anterior.name
            fur=bpy.data.objects.get(lid.name+'_V025_FUR')
            if fur:
                modifier=fur.modifiers.new('V025 fur globe clearance','SHRINKWRAP');modifier.target=globe;modifier.wrap_method='NEAREST_SURFACEPOINT';modifier.wrap_mode='OUTSIDE';modifier.offset=.001
            report.append({'character':code,'side':side,'preserved_outer_seam_vertices':n,'inner_surface_clearance_m':.0008,'anterior_cap_clearance_m':.002,'production_approved':False})
    return report
