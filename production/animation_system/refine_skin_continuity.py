"""Reusable conservative skin-weight diffusion over mesh edges.

Preserves coordinates, UVs, topology, morphs and bone identities. This is a
candidate authoring repair, never a visual approval or master promotion.
"""
import numpy as np

def smooth_skin(body,iterations=24):
 groups=list(body.vertex_groups);n=len(body.data.vertices);weights=np.zeros((n,len(groups)),dtype='f4')
 for v in body.data.vertices:
  for g in v.groups:weights[v.index,g.group]=g.weight
 original=weights.copy();mass=weights.sum(axis=1);points=np.empty(n*3,dtype='f4');body.data.vertices.foreach_get('co',points);points=points.reshape(-1,3)
 edges=np.array([e.vertices[:] for e in body.data.edges]);a,b=edges.T;length=np.linalg.norm(points[a]-points[b],axis=1)
 # Short edges receive stronger continuity; do not bridge disconnected parts.
 strength=1/np.maximum(length,.001);degree=np.bincount(a,strength,minlength=n)+np.bincount(b,strength,minlength=n);degree=np.maximum(degree,1e-8)
 for _ in range(iterations):
  for j in range(len(groups)):
   neighbor=(np.bincount(a,weights[b,j]*strength,minlength=n)+np.bincount(b,weights[a,j]*strength,minlength=n))/degree
   weights[:,j]=weights[:,j]*.5+neighbor*.5
 weights*=mass[:,None]/np.maximum(weights.sum(axis=1)[:,None],1e-8)
 changed=np.max(np.abs(weights-original),axis=1)>1e-6
 for j,g in enumerate(groups):
  for i in np.flatnonzero(changed & (np.abs(weights[:,j]-original[:,j])>1e-6)):
   g.add([int(i)],float(weights[i,j]),'REPLACE')
 return {'vertices_changed':int(changed.sum()),'iterations':iterations,'max_weight_delta':float(np.max(np.abs(weights-original))),'coordinates_changed':False,'shape_keys_preserved':True}

def stabilize_mouth(patch):
 # Cheek rings must follow the head consistently. Jaw influence remains local
 # to the inner rings, with the original measured opening weights preserved.
 head=patch.vertex_groups.get('head') or patch.vertex_groups.new(name='head');jaw=patch.vertex_groups.get('jaw')
 for v in patch.data.vertices:
  weight=sum(g.weight for g in v.groups if jaw and g.group==jaw.index)
  for g in list(v.groups):patch.vertex_groups[g.group].remove([v.index])
  head.add([v.index],1-weight,'REPLACE')
  if weight:jaw.add([v.index],weight,'REPLACE')
 patch['weight_revision']='V023_HEAD_JAW_CANDIDATE';patch['production_approved']=False
 return {'vertices':len(patch.data.vertices),'seam_reconstruction_complete':False}
