"""A measured body-skin prototype; no facial rig, eye controls or production approval."""
import copy, hashlib, json, math, struct, sys, os, argparse
from pathlib import Path
import numpy as np
from native_body_profiles import profiles

def read_glb(path):
 raw=path.read_bytes();assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);offset=20+n;length=struct.unpack_from('<I',raw,offset)[0];return doc,bytearray(raw[offset+8:offset+8+length])

def save_glb(path,doc,data):
 doc['buffers'][0]['byteLength']=len(data);js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4);data+=b'\0'*(-len(data)%4)
 raw = struct.pack('<4sII',b'glTF',2,28+len(js)+len(data))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(data),b'BIN\0')+data
 with path.open('wb') as stream: stream.write(raw);stream.flush();os.fsync(stream.fileno())

def add(doc,data,array,kind,component=5126,target=None,bounds=False):
 array=np.ascontiguousarray(array,dtype='<f4' if component==5126 else '<u2');data+=b'\0'*(-len(data)%4);offset=len(data);data.extend(array.tobytes());view={'buffer':0,'byteOffset':offset,'byteLength':array.nbytes}
 if target:view['target']=target
 doc.setdefault('bufferViews',[]).append(view);a={'bufferView':len(doc['bufferViews'])-1,'componentType':component,'count':len(array),'type':kind}
 if bounds:a.update(min=array.min(0).tolist(),max=array.max(0).tolist())
 doc['accessors'].append(a);return len(doc['accessors'])-1

def read_positions(doc,data,index):
 a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']];assert 'byteStride' not in view
 return np.frombuffer(data,dtype='<f4',count=a['count']*3,offset=view.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3).copy()

def convert(point):return np.array([point[0],point[2],-point[1]])

def build(folder,code,input_version="V005",output_version="V006"):
 source=folder/(code+'_'+input_version+'.glb');doc,data=read_glb(source);prim=doc['meshes'][0]['primitives'][0]
 rest=read_positions(doc,data,prim['attributes']['POSITION']);coords=rest[:,[0,2,1]].copy();coords[:,1]*=-1
 low,high=coords.min(0),coords.max(0);coords[:,0]-=(low[0]+high[0])/2;coords[:,1]-=(low[1]+high[1])/2;coords[:,2]-=low[2];coords/=(high[2]-low[2]);rest=np.column_stack((coords[:,0],coords[:,2],-coords[:,1]))
 prim['attributes']['POSITION']=add(doc,data,rest,'VEC3',target=34962,bounds=True)
 # TRELLIS may export zero normals on tiny degenerate fur triangles. Repair only
 # their direction from the nearest valid surface vertex, preserving the geometry.
 normals=read_positions(doc,data,prim['attributes']['NORMAL']);lengths=np.linalg.norm(normals,axis=1);invalid=lengths<1e-8;repaired=int(invalid.sum())
 if repaired:
  from scipy.spatial import cKDTree
  valid=np.flatnonzero(~invalid);nearest=cKDTree(rest[valid]).query(rest[invalid])[1];normals[invalid]=normals[valid[nearest]]
 normals/=np.linalg.norm(normals,axis=1)[:,None]
 prim['attributes']['NORMAL']=add(doc,data,normals,'VEC3',target=34962)

 bones=profiles(code);names=[b[0] for b in bones];distances=[]
 for name,a,b,parent in bones[1:]:
  ab=b-a;t=np.clip(((coords-a)@ab)/(ab@ab),0,1);distances.append(np.linalg.norm(coords-a-t[:,None]*ab,axis=1))
 d=np.column_stack(distances)
 thresholds={'CHAR_MARK':.755,'CHAR_LILI':.565,'CHAR_MORZSI':.655,'CHAR_POTTY':.455,'CHAR_ZIZI':.685,'CHAR_BOGYO':.575}
 mask=coords[:,2]>thresholds[code]
 if code in ('CHAR_LILI','CHAR_BOGYO'):mask &= coords[:,1]<.02
 if code=='CHAR_POTTY':mask &= coords[:,2]<.67
 d[mask,:]=10;d[mask,names.index('head')-1]=0
 if code=='CHAR_MARK':
  torso=(np.abs(coords[:,0])<.105)&(coords[:,2]>.45)&(coords[:,2]<.70)
  for i,(name,*_) in enumerate(bones[1:]):
   if any(part in name for part in ['arm','hand','thigh','shin','foot']):d[torso,i]=10
 selected=np.argpartition(d,3,axis=1)[:,:3];dist=np.take_along_axis(d,selected,axis=1);w=(dist+.02)**-6;w/=w.sum(1,keepdims=True)
 joints=np.zeros((len(coords),4),dtype=np.uint16);joints[:,:3]=selected+1;weights=np.zeros((len(coords),4),dtype=np.float32);weights[:,:3]=w
 assert np.isfinite(weights).all() and np.allclose(weights.sum(1),1,atol=1e-6)
 prim['attributes']['JOINTS_0']=add(doc,data,joints,'VEC4',5123,34962);prim['attributes']['WEIGHTS_0']=add(doc,data,weights,'VEC4',5126,34962)
 joint_start=len(doc['nodes']);matrices=[]
 for name,a,b,parent in bones:
  head=convert(a);parent_head=convert(bones[names.index(parent)][1]) if parent else np.zeros(3)
  node={'name':name,'translation':(head-parent_head).tolist()};doc['nodes'].append(node)
  if parent:doc['nodes'][joint_start+names.index(parent)].setdefault('children',[]).append(joint_start+names.index(name))
  inv=np.eye(4);inv[:3,3]=-head;matrices.append(inv.T.reshape(16))
 doc['skins']=[{'name':code+'_BODY_DRAFT','joints':list(range(joint_start,joint_start+len(bones))),'skeleton':joint_start,'inverseBindMatrices':add(doc,data,np.array(matrices),'MAT4')}]
 doc['nodes'][0]['skin']=0;doc['scenes'][0]['nodes'].append(joint_start)
 times=np.array([[0],[.75],[1.5],[2.25],[3]],dtype=np.float32);time_accessor=add(doc,data,times,'SCALAR',bounds=True)
 animated='forearm.L' if code in ('CHAR_MARK','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI') else 'tail_01';angles=[0,.16,-.16,.16,0];rotations=[]
 for angle in angles:rotations.append([0,math.sin(angle/2),0,math.cos(angle/2)] if code in ('CHAR_LILI','CHAR_BOGYO') else [0,0,math.sin(angle/2),math.cos(angle/2)])
 animation={'name':code+'_BODY_DEFORMATION_CHECK','samplers':[{'input':time_accessor,'output':add(doc,data,np.array(rotations),'VEC4'),'interpolation':'LINEAR'}],'channels':[{'sampler':0,'target':{'node':joint_start+names.index(animated),'path':'rotation'}}]};doc['animations']=[animation]
 doc['extras']={'status':'DRAFT_BODY_RIG','facial_ready':False,'eyes_independent':False,'production_approved':False}
 # Independently evaluate linear-blend skinning at a non-rest pose and export the actual posed surface.
 angle=.16;c,s=math.cos(angle),math.sin(angle);rotation=np.array([[c,-s,0],[s,c,0],[0,0,1]]) if code in ('CHAR_MARK','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI') else np.array([[c,0,s],[0,1,0],[-s,0,c]])
 pivot=convert(bones[names.index(animated)][1]);affected=[]
 for i,bone in enumerate(bones):
  cursor=bone[0]
  while cursor:
   if cursor==animated:affected.append(i);break
   cursor=bones[names.index(cursor)][3]
 blend=np.isin(joints,affected)*weights;amount=blend.sum(1);posed=rest+amount[:,None]*((rest-pivot)@rotation.T+pivot-rest)
 delta=np.linalg.norm(posed-rest,axis=1);assert np.isfinite(posed).all() and delta.max()>.005
 out=folder/(code+'_'+output_version+'_BODY_DRAFT.glb');save_glb(out,doc,data.copy())
 snapshot=copy.deepcopy(doc);snapshot.pop('skins');snapshot.pop('animations');snapshot['nodes'][0].pop('skin');snapshot['meshes'][0]['primitives'][0]['attributes'].pop('JOINTS_0');snapshot['meshes'][0]['primitives'][0]['attributes'].pop('WEIGHTS_0')
 snapshot['meshes'][0]['primitives'][0]['attributes']['POSITION']=add(snapshot,data,posed,'VEC3',target=34962,bounds=True);save_glb(folder/(code+'_'+output_version+'_POSE_CHECK.glb'),snapshot,data)
 verified,_=read_glb(out);assert len(verified['skins'])==1 and len(verified['animations'])==1
 report={'character':code,'status':'DRAFT_BODY_RIG_REQUIRES_DEFORMATION_REVIEW','bones':len(bones),'vertices':len(coords),'body_rig_created':True,'normal_vectors_repaired':repaired,'facial_ready':False,'production_approved':False,'maximum_pose_displacement':float(delta.max()),'moving_vertices':int((delta>.001).sum()),'retopology_completed':False,'eyes_independent':False,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}
 (folder/(code+'_'+output_version+'_rig_check.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('directory');parser.add_argument('--input-version',default='V005');parser.add_argument('--output-version',default='V006');parser.add_argument('--characters',nargs='+',default=['CHAR_MARK','CHAR_LILI']);args=parser.parse_args()
 for code in args.characters:build(Path(args.directory),code,args.input_version,args.output_version)
 os.sync()
