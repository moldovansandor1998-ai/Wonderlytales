"""Make a separate lower-density animation candidate; never overwrite the master.

This is triangle reduction, not hand-authored facial retopology.
blender -b --python simplify_tripo_mark.py -- INPUT_BLEND OUTPUT_DIRECTORY
"""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
s=bpy.context.scene;s.frame_set(0)
body=next(o for o in s.objects if o.type=='MESH')
before={'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons)}
bpy.context.view_layer.objects.active=body;body.select_set(True)
modifier=body.modifiers.new('Animation candidate triangle reduction','DECIMATE');modifier.ratio=.075;modifier.use_collapse_triangulate=True
body.modifiers.move(len(body.modifiers)-1,0)
bpy.ops.object.modifier_apply(modifier=modifier.name)
after={'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons)}
assert after['triangles']<before['triangles']*.1
assert body.data.uv_layers and len(body.vertex_groups)>10
def coordinates(frame):
    s.frame_set(frame);obj=body.evaluated_get(bpy.context.evaluated_depsgraph_get());m=obj.to_mesh()
    a=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',a);obj.to_mesh_clear();return a.reshape(-1,3)
rest=coordinates(0);posed=coordinates(18);delta=np.linalg.norm(posed-rest,axis=1)
assert np.isfinite(posed).all() and delta.max()>.005
s.frame_set(0);s['asset_status']='SIMPLIFIED_BODY_RIG_CANDIDATE';s['facial_ready']=False;s['production_approved']=False
output=out/'CHAR_MARK_TRIPO_V004_SIMPLIFIED_BODY_DRAFT.blend'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(output.resolve()),compress=True)
bpy.ops.wm.open_mainfile(filepath=str(output.resolve()))
assert any(o.type=='ARMATURE' for o in bpy.context.scene.objects)
report={'status':'SIMPLIFIED_BODY_RIG_CANDIDATE','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'before':before,'after':after,'uv_preserved':True,'vertex_groups_preserved':True,'reopened':True,
 'maximum_pose_displacement':float(delta.max()),'moving_vertices':int((delta>.001).sum()),
 'facial_ready':False,'manual_quad_retopology_completed':False,'production_approved':False,
 'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size}
(out/'MARK_TRIPO_simplification_QC.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
