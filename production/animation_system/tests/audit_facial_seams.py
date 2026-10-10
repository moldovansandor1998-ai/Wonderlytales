"""Independent full-timeline native seam correspondence audit (eyes and mouth)."""
import bpy,sys,json,math
import numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from animation_system.spec import digest,atomic_json
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);s=bpy.context.scene
items=[];reports={}
for patch in s.objects:
 if patch.get('seam_body') is None:continue
 body=bpy.data.objects[patch['seam_body']];bi=list(patch['seam_body_indices']);pi=list(patch['seam_patch_indices']);edges={tuple(sorted(e.vertices)) for e in body.data.edges};missing=sum(tuple(sorted((a,b))) not in edges for a,b in zip(bi,bi[1:]+bi[:1]))
 items.append((patch,body,pi,bi));reports[patch.name]={'pairs':len(pi),'missing_body_edges':missing,'max_gap_m':0.,'max_gap_frame':None,'nonfinite_frames':0}
for frame in range(s.frame_start,s.frame_end+1):
 s.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get()
 for patch,body,pi,bi in items:
  p=patch.evaluated_get(dep);b=body.evaluated_get(dep);pm=p.to_mesh();bm=b.to_mesh()
  try:
   a=np.array([p.matrix_world@pm.vertices[i].co for i in pi]);c=np.array([b.matrix_world@bm.vertices[i].co for i in bi]);gap=float(np.linalg.norm(a-c,axis=1).max());r=reports[patch.name]
   if gap>r['max_gap_m']:r['max_gap_m']=gap;r['max_gap_frame']=frame
   if not np.isfinite(a).all() or not np.isfinite(c).all():r['nonfinite_frames']+=1
  finally:p.to_mesh_clear();b.to_mesh_clear()
 if frame%240==0:print('SEAM_FRAME',frame,flush=True)
report={'source_sha256':digest(source),'frames':s.frame_end-s.frame_start+1,'meshes':reports,'seam_pass':bool(items) and all(not r['missing_body_edges'] and not r['nonfinite_frames'] and r['max_gap_m']<1e-5 for r in reports.values()),'production_approved':False,'limitations':'Measures mapped native boundary edges and positions; does not approve eye shape, self-intersections, speech or natural motion.'}
atomic_json(out,report);print('SEAM_AUDIT',json.dumps(report),flush=True)
