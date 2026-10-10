"""Measure evaluated native geometry without rendering; never grants visual approval."""
import bpy,json,sys,math,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from animation_system.quality import MouthQuality
src,regfile,out=map(Path,sys.argv[sys.argv.index('--')+1:])
reg=json.loads(regfile.read_text());bpy.ops.wm.open_mainfile(filepath=str(src.resolve()),use_scripts=False)
scene=bpy.context.scene;checks={};previous={}
report={'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'frames':scene.frame_end,'sampling':'every 24 frames plus specified transition frames; not full-frame approval','characters':{},'production_approved':False}
for c,a in reg['characters'].items():
 r=bpy.data.objects.get(a['rig']);p=bpy.data.objects.get(c+'_FACIAL_TOPOLOGY');body=bpy.data.objects.get(a['body'])
 if not (r and p and body):continue
 edges=np.array([e.vertices[:] for e in body.data.edges]);points=np.array([v.co[:] for v in body.data.vertices]);length=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1);mask=length>1e-4
 checks[c]=(r,p,body,MouthQuality([p,body],reg),a,edges[mask],length[mask])
 report['characters'][c]={'max_foot_error_m':0,'max_reach_ratio':0,'max_joint_speed_deg_s':0,'max_body_stretch':1}
frames=sorted(set(range(1,scene.frame_end+1,24))|{119,120,121,122,239,240,241,242,719,720,721,722,723,724,725,730,744,768,911,912,913,914,935,936,937,938})
report['sampled_frames']=frames
for f in frames:
 scene.frame_set(f);dep=bpy.context.evaluated_depsgraph_get()
 for c,(r,p,body,q,a,edges,length) in checks.items():
  result=report['characters'][c];ev=r.evaluated_get(dep)
  if True:
   ep=p.evaluated_get(dep);mesh=ep.to_mesh();points=np.empty(len(mesh.vertices)*3,dtype='f4');mesh.vertices.foreach_get('co',points);q.sample(p,points.reshape(-1,3),ev);ep.to_mesh_clear();q.sample_seams(dep)
   eb=body.evaluated_get(dep);mesh=eb.to_mesh();points=np.empty(len(mesh.vertices)*3,dtype='f4');mesh.vertices.foreach_get('co',points);points=points.reshape(-1,3);ratio=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1)/length;j=int(np.argmax(ratio))
   if ratio[j]>result['max_body_stretch']:
    result['max_body_stretch']=float(ratio[j]);result['worst_body_edge']={'frame':f,'vertices':[int(v) for v in edges[j]],'rest_length':float(length[j]),'rest_positions':[list(body.data.vertices[v].co) for v in edges[j]],'weights':[{body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[v].groups} for v in edges[j]]}
   eb.to_mesh_clear()
  for foot in a['feet']:
   hip=ev.matrix_world@ev.pose.bones[foot['upper']].head;ankle=ev.matrix_world@ev.pose.bones[foot['lower']].tail;target=ev.matrix_world@ev.pose.bones[foot['control']].head
   reach=sum(ev.data.bones[n].length for n in [foot['upper'],foot['lower']])*ev.matrix_world.to_scale().x
   error=(ankle-target).length;reach_ratio=(target-hip).length/reach
   if error>result['max_foot_error_m']:result['max_foot_error_m']=error;result['worst_foot']={'frame':f,'foot':foot['foot'],'reach_ratio':reach_ratio}
   result['max_reach_ratio']=max(result['max_reach_ratio'],reach_ratio)
   for name in [foot['upper'],foot['lower']]:
    quat=ev.matrix_world.to_quaternion()@ev.pose.bones[name].matrix.to_quaternion();old=previous.get((c,name))
    if old:
     angle=quat.rotation_difference(old[1]).angle;speed=math.degrees(min(angle,math.tau-angle))*scene.render.fps/(f-old[0])
     if speed>result['max_joint_speed_deg_s']:result['max_joint_speed_deg_s']=speed;result['worst_joint']={'frame':f,'joint':name}
    previous[c,name]=(f,quat.copy())
 if f%240==0:out.write_text(json.dumps(report,indent=2));print('QC_FRAME',f,flush=True)
for c,(_,_,_,q,*_) in checks.items():report['characters'][c]['mouth']=q.result()
out.write_text(json.dumps(report,indent=2));print('NATIVE_QC',json.dumps({c:{k:v for k,v in a.items() if not isinstance(v,dict)} for c,a in report['characters'].items()}),flush=True)
