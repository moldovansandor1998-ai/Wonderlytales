"""Rebuild Mark's oral surface against a connected, measured native body boundary.

Keeps V021's frozen rig/actions and other characters. Boundary vertices copy
body shape deltas and skin weights. No overlay or depth-displacement hiding.
"""
import bpy,bmesh,sys,json,math,os
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.facial import Surface,native_mesh,ring_faces,driver
from animation_system.spec import smooth,digest,atomic_json

def ordered_boundary(edges):
 remaining=set(edges);adj={v:[e for e in edges if v in e.verts] for e in edges for v in e.verts}
 if any(len(es)!=2 for es in adj.values()):raise ValueError('Mouth cut must have degree-two boundary')
 loops=[]
 while remaining:
  e=remaining.pop();start=e.verts[0];v=e.verts[1];loop=[start]
  while v!=start:
   loop.append(v);n=[e for e in adj[v] if e in remaining]
   if len(n)!=1:raise ValueError('Broken mouth boundary')
   e=n[0];remaining.remove(e);v=e.other_vert(v)
  loops.append(loop)
 loop=max(loops,key=len)
 area=sum(a.co.x*b.co.z-b.co.x*a.co.z for a,b in zip(loop,loop[1:]+loop[:1]))
 if area<0:loop.reverse()
 return loop

def repair(source,registry_path,out,raw_model):
 out.mkdir(parents=True,exist_ok=True)
 if digest(source)!='2840932b51f97780e3e6bdfd85cdd812cf1df2f36ecefb734b94a35cd25bb082':raise ValueError('Requires latest V021 driver-fixed master, not the earlier export')
 if digest(raw_model)!='0d3ffde042f173a0f999dcc71d835c196e978a06685268b1eab005da7e3419ee':raise ValueError('Original Mark Tripo source checksum mismatch')
 bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False)
 s=bpy.context.scene;reg=json.loads(registry_path.read_text());a=reg['characters']['CHAR_MARK'];body=bpy.data.objects[a['body']];rig=bpy.data.objects[a['rig']];old=bpy.data.objects['CHAR_MARK_FACIAL_TOPOLOGY']
 # Restore the original Tripo surface while keeping the versioned rig,
 # bone weights, action assets and body object identity.
 old_points=[v.co.copy() for v in body.data.vertices]
 old_weights=[{body.vertex_groups[g.group].name:g.weight for g in v.groups} for v in body.data.vertices]
 old_shapes={k.name:[v.co.copy() for v in k.data] for k in body.data.shape_keys.key_blocks}
 tree=KDTree(len(old_points))
 for i,v in enumerate(old_points):tree.insert(v,i)
 tree.balance();before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(raw_model));imported=[o for o in bpy.data.objects if o not in before];raw=next(o for o in imported if o.type=='MESH')
 raw.data.transform(raw.matrix_world);raw.matrix_world.identity()
 # The original body-rig importer normalized height and centred x/y AFTER
 # orientation. Recover that exact bind-space transform against retained skin.
 raw_points=np.array([v.co[:] for v in raw.data.vertices]);height=raw_points[:,2].max()-raw_points[:,2].min();sample=raw_points[::max(1,len(raw_points)//1800)];best=(float('inf'),None,None)
 for degrees in np.arange(-30,31,1):
  angle=math.radians(float(degrees));rot=np.array([[math.cos(angle),-math.sin(angle),0],[math.sin(angle),math.cos(angle),0],[0,0,1]])
  rotated=raw_points@rot.T;lo=rotated.min(0);hi=rotated.max(0);centre=np.array([(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,lo[2]]);trial=(sample@rot.T-centre)/height;dist=sorted(tree.find(Vector(p))[2] for p in trial);cost=float(np.mean(np.square(dist[:int(len(dist)*.8)])))
  if cost<best[0]:best=(cost,rot,centre);orientation_degrees=float(degrees)
 points=(raw_points@best[1].T-best[2])/height;raw.data.vertices.foreach_set('co',points.astype('f4').ravel());raw.data.update();print('SOURCE_BIND_TRANSFORM',orientation_degrees,height,best[0],flush=True)
 bpy.context.view_layer.objects.active=raw;raw.select_set(True)
 decimate=raw.modifiers.new('Preserve original Tripo identity animation density','DECIMATE');decimate.ratio=.075;decimate.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=decimate.name)
 nearest=[tree.find(v.co)[1] for v in raw.data.vertices];materials=list(body.data.materials);body.shape_key_clear();body.data=raw.data.copy();body.data.materials.clear()
 for m in materials:body.data.materials.append(m)
 for g in list(body.vertex_groups):body.vertex_groups.remove(g)
 groups={}
 for i,j in enumerate(nearest):
  for name,w in old_weights[j].items():
   if name not in groups:groups[name]=body.vertex_groups.new(name=name)
   groups[name].add([i],w,'REPLACE')
 body.shape_key_add(name='Basis')
 for name,coords in old_shapes.items():
  if name=='Basis':continue
  key=body.shape_key_add(name=name)
  for i,v in enumerate(key.data):j=nearest[i];v.co+=coords[j]-old_points[j]
  if name in rig:driver(key,'value',rig,name,'max(0,min(1,c))')
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 # Preserve V021's independent eye controls by removing the original baked eye
 # surfaces only. The mouth is rebuilt below from the restored original skin.
 bm=bmesh.new();bm.from_mesh(body.data)
 eye_regions=[(-.059,.828,.0242,.0187),(.017,.831,.0242,.0198)]
 eye_faces=[f for f in bm.faces if any(any(((v.co.x-x)/w)**2+((v.co.z-z)/h)**2<1 and v.co.y<-.065 for v in f.verts) for x,z,w,h in eye_regions)]
 bmesh.ops.delete(bm,geom=eye_faces,context='FACES');bm.to_mesh(body.data);bm.free()
 # Read source texture and original lip forms before deleting the damaged cheek.
 surf=Surface(body);old_keys={k.name:np.array([v.co[:] for v in k.data]) for k in old.data.shape_keys.key_blocks};old_n=int(old['ring_vertices']);cx,zc=-.021,.769
 bm=bmesh.new();bm.from_mesh(body.data);near=[v for v in bm.verts if abs(v.co.x-cx)<.08 and abs(v.co.z-zc)<.05 and v.co.y<-.055]
 bmesh.ops.remove_doubles(bm,verts=near,dist=.0003)
 # Split triangles at the exact convex mouth perimeter. Vertex-threshold
 # deletion creates a sawtooth, non-star-shaped cut which folds radial loops.
 normals=[]
 for j in range(48):
  angle=j*math.tau/48;normal=Vector((math.cos(angle)/.044,0,math.sin(angle)/.021));point=Vector((cx+.044*math.cos(angle),-.13,zc+.021*math.sin(angle)));normals.append((normal,point))
  region=[f for f in bm.faces if any(((v.co.x-cx)/.060)**2+((v.co.z-zc)/.032)**2<1 and v.co.y<-.075 for v in f.verts)];geom=set(region)
  for face in region:geom.update(face.verts);geom.update(face.edges)
  bmesh.ops.bisect_plane(bm,geom=list(geom),dist=1e-7,plane_co=point,plane_no=normal,use_snap_center=True)
 removed={f for f in bm.faces if f.calc_center_median().y<-.075 and all((f.calc_center_median()-p).dot(n)<1e-6 for n,p in normals)}
 edges={e for e in bm.edges if any(f in removed for f in e.link_faces) and any(f not in removed for f in e.link_faces)}
 cut_layer=bm.verts.layers.int.new('V022_cut_boundary')
 for e in edges:
  for v in e.verts:v[cut_layer]=1
 bmesh.ops.delete(bm,geom=list(removed),context='FACES')
 # Imported UV fragments leave very small endpoint cracks. Merge only paired
 # cut endpoints, with a strict 3 mm LOCAL cap; do not broadly decimate the head.
 repairs=[]
 while True:
  edges={e for e in bm.edges if e.is_boundary and all(v[cut_layer] for v in e.verts)};degree={v:sum(v in e.verts for e in edges) for e in edges for v in e.verts};ends=[v for v,d in degree.items() if d==1]
  if not ends:break
  if len(ends)%2:raise ValueError('Odd cut endpoints')
  p,q=min(((v,u) for i,v in enumerate(ends) for u in ends[i+1:]),key=lambda pair:(pair[0].co-pair[1].co).length)
  gap=(p.co-q.co).length
  print('CRACK_PAIR',gap,len(ends),[list(v.co) for v in ends],flush=True)
  if gap>.003:raise ValueError('Boundary crack exceeds repair tolerance')
  repairs.append(gap);bmesh.ops.pointmerge(bm,verts=[p,q],merge_co=(p.co+q.co)*.5)
 boundary=ordered_boundary({e for e in bm.edges if e.is_boundary and all(v[cut_layer] for v in e.verts)});bm.verts.index_update();ids=[v.index for v in boundary];boundary_co=[v.co.copy() for v in boundary]
 bm.to_mesh(body.data);bm.free();body.data.update()
 # Lookup again after to_mesh; all shape keys and UV corners remain native.
 weights=[{body.vertex_groups[g.group].name:g.weight for g in body.data.vertices[i].groups} for i in ids]
 body_keys={k.name:[k.data[i].co.copy() for i in ids] for k in body.data.shape_keys.key_blocks}
 N=len(ids);R=12;angles=[math.atan2((v.z-zc)/.021,(v.x-cx)/.044)%math.tau for v in boundary_co]
 def lip_sample(key,angle):
  u=angle/math.tau*old_n;j=int(u)%old_n;f=u-int(u);return Vector(key[j]*(1-f)+key[(j+1)%old_n]*f)
 # Source skin sampling retains neutral lip depth and texture identity.
 verts=[];bindings=[];colors=[]
 for k in range(R):
  f=k/(R-1);u=smooth(f)
  for j,(edge,angle) in enumerate(zip(boundary_co,angles)):
   v=Vector((cx+(.029+(.044-.029)*u)*math.cos(angle),edge.y,zc+(.0003+(.021-.0003)*u)*math.sin(angle)))
   hit,_=surf.hit(v.x,v.z,edge.y);v.y=hit.y-.00015*(1-f)**2
   if k==R-1:v=edge.copy()
   verts.append(v);jaw=smooth(-math.sin(angle))*.82*(1-f)**3;blend=smooth(f/.65);binding={b:w*blend for b,w in weights[j].items()};binding['head']=binding.get('head',0)+(1-jaw)*(1-blend);binding['jaw']=binding.get('jaw',0)+jaw*(1-blend);bindings.append(binding)
   color=surf.color(v.x,v.z,edge.y);colors.append(color)
 patch=native_mesh(s,rig,body,'CHAR_MARK_FACIAL_TOPOLOGY_V022',verts,ring_faces(N,R),old.data.materials[0],bindings,colors)
 # Use old name so existing compiler/review paths continue to resolve it.
 collection=bpy.data.collections[a['collection']]
 for c in list(patch.users_collection):c.objects.unlink(patch)
 collection.objects.link(patch);bpy.data.objects.remove(old,do_unlink=True);patch.name='CHAR_MARK_FACIAL_TOPOLOGY'
 patch.shape_key_add(name='Basis')
 for name,key in old_keys.items():
  if name=='Basis':continue
  new=patch.shape_key_add(name=name)
  for i,v in enumerate(new.data):
   f=(i//N)/(R-1);j=i%N;delta=lip_sample(key,angles[j])-lip_sample(old_keys['Basis'],angles[j]);v.co+=delta*(1-f)**3
  driver(new,'value',rig,name,'max(0,min(1,c))')
 # Copy boundary/body expressive shapes, including any tiny brow influence.
 for name,coords in body_keys.items():
  if name=='Basis':continue
  key=patch.data.shape_keys.key_blocks.get(name) or patch.shape_key_add(name=name)
  for i,v in enumerate(key.data):j=i%N;f=(i//N)/(R-1);v.co+=(coords[j]-body_keys['Basis'][j])*smooth(f)
  if name in rig:driver(key,'value',rig,name,'max(0,min(1,c))')
 patch['ring_vertices']=N;patch['boundary_matched']=True;patch['topology_revision']='V022';patch['seam_body']=body.name;patch['seam_body_indices']=ids;patch['seam_patch_indices']=list(range((R-1)*N,R*N));patch['topology']='concentric quad lip loops with native shared boundary bindings'
 a['version']='V022';a['face']['boundary_mapping']='native vertex correspondence';a['face']['professional_quality_approved']=False;a['face']['source_crack_merge_distances_m_local']=repairs;rig['asset_version']='V022';reg['version']='V022';reg['master_file']='MASTER_CAST_V022.blend';reg['source_sha256']=digest(source);reg['professional_quality_approved']=False
 # V021's oral parts used the offset facial centre; follow the original
 # Tripo mouth axis while retaining their head/jaw bind groups.
 for name in ['ORAL_CAVITY','UPPER_TEETH','LOWER_TEETH','TONGUE']:
  oral=bpy.data.objects.get('CHAR_MARK_'+name)
  if oral:
   for v in oral.data.vertices:v.co.x=-.021+(v.co.x+.004)*( .029/.024 )
 from animation_system.regularize_mark_loops import regularize
 a['face']['perimeter_regularization']=regularize(body,patch)
 from animation_system.refine_mark_neck import refine
 a['continuous_neck_binding']=refine(body,patch)
 s['status']='V022_SEAM_REPAIR_DEVELOPMENT';bpy.ops.file.pack_all();path=out/reg['master_file'];bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True);sha=digest(path)
 for asset in list(reg['characters'].values())+list(reg['locations'].values()):asset['asset_sha256']=sha
 atomic_json(out/'perimeter_QC_V022.json',a['face']['perimeter_regularization']);atomic_json(out/'neck_authoring_V022.json',a['continuous_neck_binding']);atomic_json(out/'asset_registry_V022.json',reg);atomic_json(out/'seam_authoring_V022.json',{'boundary_vertices':N,'body_vertices':len(body.data.vertices),'patch_vertices':len(patch.data.vertices),'crack_merges_m_local':repairs,'source_sha256':reg['source_sha256'],'master_sha256':sha,'professional_quality_approved':False})
 print('V022_REPAIRED',N,repairs,flush=True)
if __name__=='__main__':repair(*map(lambda p:Path(p).resolve(),sys.argv[sys.argv.index('--')+1:]))
