"""Regularize a measured mouth perimeter without changing bind weights/identity.

The source triangle cuts have submillimetre angular reversals. A strictly
ordered convex perimeter removes those reversals, and all shape-key boundaries
follow the same native source-vertex correspondence.
"""
import bpy,sys,json,math
import numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import smooth,digest,atomic_json
from animation_system.facial import FORMS

def regularize(body,patch):
 bi=list(patch['seam_body_indices']);pi=list(patch['seam_patch_indices']);N=len(bi);R=len(patch.data.vertices)//N;cx,zc=-.021,.769;w,h=.044,.021
 original=np.array([body.data.vertices[i].co[:] for i in bi]);angles=np.unwrap(np.arctan2((original[:,2]-zc)/h,(original[:,0]-cx)/w));epsilon=1e-5
 # Pool adjacent violators: minimal angular correction with strict ordering.
 blocks=[]
 for i,value in enumerate(angles-np.arange(N)*epsilon):
  blocks.append([float(value),1,[i]])
  while len(blocks)>1 and blocks[-2][0]>blocks[-1][0]:
   right=blocks.pop();left=blocks.pop();count=left[1]+right[1];blocks.append([(left[0]*left[1]+right[0]*right[1])/count,count,left[2]+right[2]])
 ordered=np.empty(N)
 for value,count,indices in blocks:ordered[indices]=value
 ordered+=np.arange(N)*epsilon
 if ordered[-1]-ordered[0]>=math.tau:raise ValueError('Invalid cyclic perimeter')
 boundary=original.copy();boundary[:,0]=cx+w*np.cos(ordered);boundary[:,2]=zc+h*np.sin(ordered);delta=boundary-original;maxshift=float(np.max(np.linalg.norm(delta,axis=1)))
 if maxshift>.002:raise ValueError('Perimeter correction exceeds 2 mm local cap')
 for j,i in enumerate(bi):
  body.data.vertices[i].co+=__import__('mathutils').Vector(delta[j])
  for key in body.data.shape_keys.key_blocks:key.data[i].co+=__import__('mathutils').Vector(delta[j])
 basis=patch.data.shape_keys.key_blocks['Basis'];old=np.array([v.co[:] for v in basis.data]);new=old.copy()
 for k in range(R):
  f=k/(R-1);u=smooth(f);ring=slice(k*N,(k+1)*N);new[ring,0]=cx+(.029+(w-.029)*u)*np.cos(ordered);new[ring,2]=zc+(.0003+(h-.0003)*u)*np.sin(ordered)
 for key in patch.data.shape_keys.key_blocks:
  for i,v in enumerate(key.data):v.co+=__import__('mathutils').Vector(new[i]-old[i])
 for i,v in enumerate(patch.data.vertices):v.co=basis.data[i].co
 for name,(wf,upper,lower,protrude,jaw_angle) in FORMS.items():
  key=patch.data.shape_keys.key_blocks['viseme_'+name]
  for i,v in enumerate(key.data):
   f=(i//N)/(R-1);a=ordered[i%N];influence=(1-f)**3;v.co=basis.data[i].co;v.co.x=cx+(v.co.x-cx)*(1+(wf-1)*influence);v.co.z+=math.sin(a)*((upper if math.sin(a)>0 else lower)-.0003)*influence;v.co.y-=protrude*influence
 # Restore exact copied body expression deltas at the outer boundary.
 for name in ['brow_up','brow_down']:
  key=patch.data.shape_keys.key_blocks.get(name)
  if key:
   bk=body.data.shape_keys.key_blocks[name];bb=body.data.shape_keys.key_blocks['Basis']
   for i,j in zip(pi,bi):key.data[i].co=basis.data[i].co+(bk.data[j].co-bb.data[j].co)
 patch.data.update();body.data.update();patch['perimeter_regularized']=True;patch['perimeter_max_correction_m_local']=maxshift
 return {'max_boundary_correction_m_local':maxshift,'ordered_boundary_vertices':N}

def main(source,registry_path):
 bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);patch=bpy.data.objects['CHAR_MARK_FACIAL_TOPOLOGY'];body=bpy.data.objects[patch['seam_body']];report=regularize(body,patch);bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True);reg=json.loads(registry_path.read_text());sha=digest(source)
 for asset in list(reg['characters'].values())+list(reg['locations'].values()):asset['asset_sha256']=sha
 reg['characters']['CHAR_MARK']['face']['perimeter_regularization']=report;atomic_json(registry_path,reg);atomic_json(source.parent/'perimeter_QC_V022.json',report);print('PERIMETER_REGULARIZED',report,flush=True)
if __name__=='__main__':main(*map(lambda p:Path(p).resolve(),sys.argv[sys.argv.index('--')+1:]))
