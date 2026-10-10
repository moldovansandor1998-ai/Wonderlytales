"""Sample actual body/patch seam vertices under combined native facial poses."""
import bpy,sys,json,math
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import atomic_json,digest
from animation_system.quality import MouthQuality

def verify(patch,body,rig):
 bi=list(patch['seam_body_indices']);pi=list(patch['seam_patch_indices']);dep=bpy.context.evaluated_depsgraph_get();p=patch.evaluated_get(dep);b=body.evaluated_get(dep);pm=p.to_mesh();bm=b.to_mesh()
 pp=np.array([list(p.matrix_world@pm.vertices[i].co) for i in pi]);bp=np.array([list(b.matrix_world@bm.vertices[i].co) for i in bi]);p.to_mesh_clear();b.to_mesh_clear();return float(np.max(np.linalg.norm(pp-bp,axis=1)))

def main(source,out):
 bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);s=bpy.context.scene;patch=bpy.data.objects['CHAR_MARK_FACIAL_TOPOLOGY'];body=bpy.data.objects[patch['seam_body']];rig=bpy.data.objects['CHAR_MARK_BODY_DRAFT'];records=[];quality=MouthQuality([body,patch],{});patch.data.calc_loop_triangles();tri=np.array([t.vertices[:] for t in patch.data.loop_triangles]);rest=np.array([v.co[:] for v in patch.data.vertices]);norm=np.cross(rest[tri[:,1]]-rest[tri[:,0]],rest[tri[:,2]]-rest[tri[:,0]]);folded=int(np.count_nonzero(norm[:,1]>1e-10))
 for form in 'XABCDEFGH':
  for jaw in [0,.5,1]:
   for rotation in [0,.35,-.35]:
    for name in 'XABCDEFGH':rig['viseme_'+name]=float(name==form)
    rig['jaw_open']=jaw;rig['smile']=.5 if rotation>0 else 0;rig['frown']=.5 if rotation<0 else 0;rig['brow_up']=.8;rig.pose.bones['CTRL_head'].rotation_euler=(rotation*.3,rotation*.4,rotation)
    rig.update_tag();s.frame_set(1);bpy.context.view_layer.update();gap=verify(patch,body,rig);dep=bpy.context.evaluated_depsgraph_get();ev=patch.evaluated_get(dep);mesh=ev.to_mesh();quality.sample(patch,np.array([v.co[:] for v in mesh.vertices]),rig.evaluated_get(dep));ev.to_mesh_clear();quality.sample_seams(dep);records.append({'viseme':form,'jaw':jaw,'head_yaw':rotation,'max_seam_gap_m':gap})
 geometry=quality.result();result={'master_sha256':digest(source),'native_geometry_qc':geometry,'rest_folded_front_triangles':folded,'sampled_poses':len(records),'boundary_vertex_pairs':len(patch['seam_body_indices']),'max_seam_gap_m':max(x['max_seam_gap_m'] for x in records),'tolerance_m':.00001,'seam_continuity_pass':all(x['max_seam_gap_m']<.00001 for x in records),'facial_geometry_pass':folded==0 and geometry['pass'],'professional_quality_approved':False,'records':records};atomic_json(out,result);print('NATIVE_SEAM_QC',json.dumps({k:v for k,v in result.items() if k!='records'}),flush=True)
 if not result['seam_continuity_pass'] or not result['facial_geometry_pass']:raise ValueError('Native facial seam does not remain closed')
if __name__=='__main__':main(*map(lambda p:Path(p).resolve(),sys.argv[sys.argv.index('--')+1:]))
