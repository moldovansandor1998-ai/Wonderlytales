"""Native facial geometry checks independent of rendered camera or control UI."""
import numpy as np
from mathutils import Vector

class MouthQuality:
 def __init__(self,objects,registry):
  self.items={};self.seams=[];self.missing_seams=[];self.max_seam_gap=0.;self.seam_samples=0;self.unmatched_boundaries=[];self.stats={'sampled_mesh_frames':0,'nonfinite':0,'max_outer_edge_stretch_ratio':1.,'flipped_outer_triangles':0,'invalid_viseme_frames':0,'rest_folded_front_triangles':0}
  for o in objects:
   if not o.name.endswith('_FACIAL_TOPOLOGY'):continue
   if not o.get('boundary_matched',False):self.unmatched_boundaries.append(o.name)

   body=next((b for b in objects if b.name==o.get('seam_body')),None)
   if body is not None and o.get('seam_body_indices') is not None:self.seams.append((o,body,list(o['seam_patch_indices']),list(o['seam_body_indices'])))
   else:self.missing_seams.append(o.name)
   o.data.calc_loop_triangles();tri=np.array([t.vertices[:] for t in o.data.loop_triangles],dtype='i4');points=np.array([v.co[:] for v in o.data.vertices]);self.stats['rest_folded_front_triangles']+=int(np.count_nonzero(np.cross(points[tri[:,1]]-points[tri[:,0]],points[tri[:,2]]-points[tri[:,0]])[:,1]>1e-10));limit=9*int(o.get('ring_vertices',64));outer=tri[np.all(tri>=limit,axis=1)];norm=np.cross(points[outer[:,1]]-points[outer[:,0]],points[outer[:,2]]-points[outer[:,0]]);length=np.linalg.norm(norm,axis=1);valid=length>1e-10;outer=outer[valid];norm=norm[valid]/length[valid,None];edges=np.array([e.vertices[:] for e in o.data.edges if all(i>=limit for i in e.vertices)],dtype='i4');rest=np.linalg.norm(points[edges[:,0]]-points[edges[:,1]],axis=1);self.items[o.name]=(outer,norm,edges,rest)
 def sample(self,obj,points,rig):
  if obj.name not in self.items:return
  tri,norm,edges,rest=self.items[obj.name];self.stats['sampled_mesh_frames']+=1;self.stats['nonfinite']+=int(np.count_nonzero(~np.isfinite(points)));head=rig.pose.bones['head'].matrix@rig.data.bones['head'].matrix_local.inverted();inv=np.array([list(r) for r in head.inverted()],dtype='f4');p=points@inv[:3,:3].T+inv[:3,3]
  deformed=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]]);dot=np.sum(deformed*norm,axis=1);self.stats['flipped_outer_triangles']+=int(np.count_nonzero(dot< -1e-9));ratio=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)/np.maximum(rest,1e-8);self.stats['max_outer_edge_stretch_ratio']=max(self.stats['max_outer_edge_stretch_ratio'],float(np.max(ratio)))
  weights=[float(rig.get('viseme_'+n,0)) for n in 'XABCDEFGH']
  if any(not np.isfinite(w) or not -.0001<=w<=1.0001 for w in weights) or abs(sum(weights)-1)>.001:self.stats['invalid_viseme_frames']+=1
 def sample_seams(self,dependency_graph):
  for patch,body,pi,bi in self.seams:
   p=patch.evaluated_get(dependency_graph);b=body.evaluated_get(dependency_graph);pm=p.to_mesh();bm=b.to_mesh()
   try:
    pp=np.array([list(p.matrix_world@pm.vertices[i].co) for i in pi]);bp=np.array([list(b.matrix_world@bm.vertices[i].co) for i in bi]);gap=float(np.max(np.linalg.norm(pp-bp,axis=1)))
    self.max_seam_gap=max(self.max_seam_gap,gap);self.seam_samples+=1
   finally:p.to_mesh_clear();b.to_mesh_clear()
 def result(self):
  stable=self.stats['rest_folded_front_triangles']==0 and self.stats['nonfinite']==0 and self.stats['invalid_viseme_frames']==0 and self.stats['flipped_outer_triangles']==0 and self.stats['max_outer_edge_stretch_ratio']<2
  seam_pass=bool(self.seams) and self.seam_samples>0 and not self.missing_seams and self.max_seam_gap<1e-5
  return {**self.stats,'sampled_seam_mesh_frames':self.seam_samples,'max_seam_gap_m':self.max_seam_gap,'missing_seam_correspondences':self.missing_seams,'outer_geometry_pass':stable,'unmatched_outer_boundaries':self.unmatched_boundaries,'boundary_mapping_pass':not self.unmatched_boundaries,'seam_continuity_verified':seam_pass,'pass':stable and not self.unmatched_boundaries and seam_pass,'limitations':'Checks outer topology and native boundary-mapping metadata. Native correspondence is measured when available; full self-intersection and natural speech still need validation'}
