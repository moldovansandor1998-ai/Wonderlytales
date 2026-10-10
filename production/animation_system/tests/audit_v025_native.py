"""Independent all-frame support/face audit plus sampled retained-finger contact."""
import bpy,sys,json,math
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from animation_system.spec import digest,atomic_json
from animation_system.quality import MouthQuality
source,registry,out=map(Path,sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene
reg=json.loads(registry.read_text());assets={c:a for c,a in reg['characters'].items() if bpy.data.objects.get(a['rig'])};mouth=MouthQuality(list(scene.objects),reg)
seams=[];seam_report={};foot_report={c:{'max_ankle_target_error_m':0.,'max_stationary_target_slide_m':0.} for c in assets};prior={};blink={c:{'L':0.,'R':0.} for c in assets};finger_report=[]
for patch in scene.objects:
 if patch.get('seam_body') is None:continue
 body=bpy.data.objects[patch['seam_body']];pi=list(patch['seam_patch_indices']);bi=list(patch['seam_body_indices']);edges={tuple(sorted(e.vertices)) for e in body.data.edges};missing=sum(tuple(sorted((a,b))) not in edges for a,b in zip(bi,bi[1:]+bi[:1]));seams.append((patch,body,pi,bi));seam_report[patch.name]={'max_gap_m':0.,'missing_body_edges':missing}
for frame in range(scene.frame_start,scene.frame_end+1):
 scene.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get();meshes={}
 def evaluated_mesh(obj):
  if obj.name not in meshes:
   ev=obj.evaluated_get(dep);meshes[obj.name]=(ev,ev.to_mesh())
  return meshes[obj.name]
 try:
  for code,asset in assets.items():
   rig=bpy.data.objects[asset['rig']];ev=rig.evaluated_get(dep)
   for side in ('L','R'):blink[code][side]=max(blink[code][side],float(rig['blink.'+side]))
   for foot in asset['feet']:
    target=ev.matrix_world@ev.pose.bones[foot['control']].head;ankle=ev.matrix_world@ev.pose.bones[foot['lower']].tail;r=foot_report[code];r['max_ankle_target_error_m']=max(r['max_ankle_target_error_m'],(ankle-target).length)
    key=(code,foot['foot']);old=prior.get(key)
    if old and (target-old[0]).length<1e-6:r['max_stationary_target_slide_m']=max(r['max_stationary_target_slide_m'],(ankle-old[1]).length)
    prior[key]=(target.copy(),ankle.copy())
   obj=bpy.data.objects.get(code+'_FACIAL_TOPOLOGY')
   if obj:
    evaluated,mesh=evaluated_mesh(obj);mouth.sample(obj,np.array([v.co[:] for v in mesh.vertices]),ev)
  for patch,body,pi,bi in seams:
   p,pm=evaluated_mesh(patch);b,bm=evaluated_mesh(body)
   a=np.array([p.matrix_world@pm.vertices[i].co for i in pi]);c=np.array([b.matrix_world@bm.vertices[i].co for i in bi]);gap=float(np.linalg.norm(a-c,axis=1).max())
   if not np.isfinite(a).all() or not np.isfinite(c).all():raise ValueError('Nonfinite native facial geometry')
   seam_report[patch.name]['max_gap_m']=max(seam_report[patch.name]['max_gap_m'],gap)
  if frame in (560,700,1153) and bpy.data.objects.get('PROP_STAR_SHARD') and bpy.data.objects[assets['CHAR_MARK']['rig']].pose.bones.get('finger_index_01.L'):
   star=bpy.data.objects['PROP_STAR_SHARD'];points=[];polygons=[]
   for part in [star]+list(star.children_recursive):
    if part.type!='MESH' or part.hide_render:continue
    se,sm=evaluated_mesh(part);offset=len(points);points.extend(se.matrix_world@v.co for v in sm.vertices);polygons.extend(tuple(offset+i for i in p.vertices) for p in sm.polygons)
   if not points:raise ValueError('Visible star geometry missing')
   tree=BVHTree.FromPolygons(points,polygons)
   body=bpy.data.objects[assets['CHAR_MARK']['body']];be,bm=evaluated_mesh(body);groups={g.index:g.name for g in body.vertex_groups};digits={}
   for vertex in body.data.vertices:
    names=[groups[g.group] for g in vertex.groups if groups[g.group].startswith('finger_') and groups[g.group].endswith('.L') and g.weight>.35]
    for name in names:
     point=be.matrix_world@bm.vertices[vertex.index].co;nearest,normal,_,distance=tree.find_nearest(point)
     if nearest is None:continue
     digit=name.split('_')[1];entry=digits.setdefault(digit,{'min_surface_gap_m':float('inf'),'max_signed_penetration_m':0.})
     entry['min_surface_gap_m']=min(entry['min_surface_gap_m'],distance);entry['max_signed_penetration_m']=max(entry['max_signed_penetration_m'],max(0,-(point-nearest).dot(normal)))
   finger_report.append({'frame':frame,'digits':digits,'limitation':'Nearest-surface signed distances are local indicators, not a watertight collision proof.'})
 finally:
  for ev,mesh in meshes.values():ev.to_mesh_clear()
 mouth.sample_seams(dep)
 if frame%240==0:print('V025_NATIVE_AUDIT_FRAME',frame,flush=True)
result={'source_sha256':digest(source),'frames':scene.frame_end-scene.frame_start+1,'feet':foot_report,'seams':seam_report,'mouth':mouth.result(),'max_blink_controls':blink,'finger_contact_samples':finger_report,'foot_support_pass':all(r['max_ankle_target_error_m']<.004 and r['max_stationary_target_slide_m']<.004 for r in foot_report.values()),'mapped_seams_pass':all(r['max_gap_m']<1e-5 and r['missing_body_edges']==0 for r in seam_report.values()),'production_approved':False,'limitations':'Does not certify anatomical appearance, fluid movement, all surface collisions, or acting quality. Separate all-angle video review is required.'}
atomic_json(out,result);print('V025_NATIVE_AUDIT',json.dumps(result),flush=True)
