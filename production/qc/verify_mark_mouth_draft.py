"""Validate saved native facial deformation, head attachment and packed speech asset.
Blender -b --python this.py -- SCENE.blend REPORT.json
"""
import bpy,sys,json,numpy as np
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=str(Path(args[0]).resolve()));s=bpy.context.scene
r=next(o for o in s.objects if o.type=='ARMATURE');body=next(o for o in s.objects if o.type=='MESH' and o.vertex_groups.get('jaw') and len(o.data.vertices)>10000);lips=bpy.data.objects['MOUTH_LIPS']
def coords(o):
    dg=bpy.context.evaluated_depsgraph_get();e=o.evaluated_get(dg);m=e.to_mesh();a=np.array([o.matrix_world@v.co for v in m.vertices]);e.to_mesh_clear();return a
s.frame_set(1);r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();b1=coords(body);l1=coords(lips)
s.frame_set(19);r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();b2=coords(body);l2=coords(lips)
db=np.linalg.norm(b2-b1,axis=1);dl=np.linalg.norm(l2-l1,axis=1)
assert (db>1e-5).sum()>100 and dl.max()>.008
assert r.pose.bones['jaw'].rotation_euler.x>.15
# Isolate controls for attachment and rounding checks, without animation overrides.
r.animation_data_clear();r['jaw_open']=0.;r['mouth_round']=0.;r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();l0=coords(lips)
r['mouth_round']=1.;r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();lr=coords(lips);round_delta=float(np.linalg.norm(lr-l0,axis=1).max());assert round_delta>.003
r['mouth_round']=0.;r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();t=bpy.data.objects['UPPER_TOOTH.00'];t0=t.matrix_world.translation.copy()
r.pose.bones['head'].rotation_euler.y=.1;r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();td=float((t.matrix_world.translation-t0).length);assert td>.001
sums=[sum(g.weight for g in v.groups) for v in body.data.vertices];assert min(sums)>.9999 and max(sums)<1.0001
assert all(i.packed_file for i in bpy.data.images if i.type=='IMAGE')
assert len(bpy.data.sounds)==1 and bpy.data.sounds[0].packed_file
report=json.loads(Path(args[1]).read_text());report['reopen_verification']={'passed':True,'jaw_angle_at_peak_rad':float(.25*max(report['speech_test']['jaw_values'])),'body_moving_vertices':int((db>1e-5).sum()),'lip_moving_vertices':int((dl>1e-5).sum()),'lip_max_motion_units':float(dl.max()),'round_shape_max_motion_units':round_delta,'head_tooth_attachment_delta_units':td,'packed_texture_images':sum(bool(i.packed_file) for i in bpy.data.images),'packed_recorded_sounds':sum(bool(x.packed_file) for x in bpy.data.sounds),'body_weight_sum_range':[min(sums),max(sums)]}
Path(args[1]).write_text(json.dumps(report,indent=2));print('MOUTH_DRAFT_VERIFIED',report['reopen_verification'])
