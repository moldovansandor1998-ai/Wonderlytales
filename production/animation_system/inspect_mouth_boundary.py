"""Read-only native oral perimeter diagnosis; no geometry is modified."""
import bpy,json,sys,math
import numpy as np
from pathlib import Path
from mathutils.kdtree import KDTree
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import FACE_PROFILES,atomic_json,digest
source,registry,dest,code=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()),use_scripts=False)
asset=json.loads(Path(registry).read_text())['characters'][code]
body=bpy.data.objects[asset['body']];patch=bpy.data.objects[code+'_FACIAL_TOPOLOGY']
N=int(patch['ring_vertices']);R=len(patch.data.vertices)//N
points=np.array([v.co[:] for v in patch.data.vertices]);outer=points[-N:]
tree=KDTree(len(body.data.vertices))
for vertex in body.data.vertices:tree.insert(vertex.co,vertex.index)
tree.balance();nearest=[tree.find(tuple(p)) for p in outer]
ids=[r[1] for r in nearest];edges={tuple(sorted(e.vertices)) for e in body.data.edges}
cx,zc,w,h=FACE_PROFILES[code]['mouth'];theta=np.arctan2((outer[:,2]-zc)/h,(outer[:,0]-cx)/w)
patch.data.calc_loop_triangles();tri=np.array([t.vertices[:] for t in patch.data.loop_triangles])
folded=np.cross(points[tri[:,1]]-points[tri[:,0]],points[tri[:,2]]-points[tri[:,0]])[:,1]>1e-10
report={'source_sha256':digest(Path(source)),'blender':bpy.app.version_string,'character':code,
 'ring_vertices':N,'rings':R,'nearest_body_max_distance':max(r[2] for r in nearest),
 'connected_outer_edges':sum(tuple(sorted((a,b))) in edges for a,b in zip(ids,ids[1:]+ids[:1])),
 'outer_bbox_xz':[[float(outer[:,i].min()),float(outer[:,i].max())] for i in (0,2)],
 'folded_triangles_by_ring':{str(i):int(np.count_nonzero(folded & (tri.min(axis=1)//N==i))) for i in range(R-1)},
 'outer_points':outer.tolist(),'inner_points':points[:N].tolist(),'nearest_body_indices':ids,
 'production_approved':False}
atomic_json(dest,report)
print(json.dumps({k:v for k,v in report.items() if k not in ('outer_points','inner_points','nearest_body_indices')}),flush=True)
