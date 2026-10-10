"""Unfold an irregular oral annulus along physical rays, preserving its border.

The legacy interpolation used different angular aspect ratios at the lip and
outer skin. Closely spaced irregular perimeter samples then crossed between
rings. Radial interpolation keeps each column on its physical XZ ray. The body,
perimeter, colors and object identity remain unchanged. Boundary edge topology
is measured separately and never inferred from nearest-point coincidence.
"""
import bpy,json,sys,math
import numpy as np
from pathlib import Path
from mathutils.kdtree import KDTree
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import FACE_PROFILES,smooth,digest,atomic_json
from animation_system.facial import FORMS

source,registry,destination,code=sys.argv[sys.argv.index('--')+1:]
source,destination=Path(source),Path(destination)
if source.resolve()==destination.resolve():raise ValueError('Separate derivative required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
asset=json.loads(Path(registry).read_text())['characters'][code]
body=bpy.data.objects[asset['body']];patch=bpy.data.objects[code+'_FACIAL_TOPOLOGY']
N=int(patch['ring_vertices']);R=len(patch.data.vertices)//N
old=np.array([v.co[:] for v in patch.data.vertices]);outer=old[-N:].copy()
cx,zc,width,height=FACE_PROFILES[code]['mouth'];centre=np.array([cx,zc])
delta=outer[:,[0,2]]-centre
physical_angles=np.sort(np.arctan2(delta[:,1],delta[:,0]))
max_gap=float(np.max(np.diff(np.r_[physical_angles,physical_angles[0]+2*math.pi])))
if max_gap>=math.pi:
    atomic_json(destination.with_suffix('.rejected.json'),{
      'source_sha256':digest(source),'character':code,'production_approved':False,
      'reason':'Mouth landmark lies outside the existing perimeter',
      'max_angular_gap_radians':max_gap,'candidate_saved':False})
    raise ValueError('Invalid aperture: restore original face and recut around mouth before remeshing')
radii=np.linalg.norm(delta,axis=1);direction=delta/radii[:,None]
inner_radius=1/np.sqrt((direction[:,0]/width)**2+(direction[:,1]/.0003)**2)
if np.any(radii<=inner_radius+1e-6):raise ValueError('Lip ellipse is not inside the existing perimeter')
new=old.copy();inner=centre+direction*inner_radius[:,None]
angles=np.arctan2((inner[:,1]-zc)/.0003,(inner[:,0]-cx)/width)
for k in range(R):
    u=smooth(k/(R-1));radius=inner_radius*(1-u)+radii*u
    new[k*N:(k+1)*N,0]=cx+direction[:,0]*radius
    new[k*N:(k+1)*N,2]=zc+direction[:,1]*radius
for key in patch.data.shape_keys.key_blocks:
    for i,vertex in enumerate(key.data):vertex.co+=Vector(new[i]-old[i])
basis=patch.data.shape_keys.key_blocks['Basis']
for i,vertex in enumerate(patch.data.vertices):vertex.co=basis.data[i].co
for name,(wf,upper,lower,protrude,jaw_angle) in FORMS.items():
    key=patch.data.shape_keys.key_blocks['viseme_'+name]
    for i,vertex in enumerate(key.data):
        f=(i//N)/(R-1);angle=angles[i%N];amount=(1-f)**3;vertex.co=basis.data[i].co
        vertex.co.x=cx+(vertex.co.x-cx)*(1+(wf-1)*amount)
        vertex.co.z+=math.sin(angle)*((upper if math.sin(angle)>0 else lower)-.0003)*amount
        vertex.co.y-=protrude*amount
for name,sign in [('smile',1),('frown',-1)]:
    key=patch.data.shape_keys.key_blocks.get(name)
    if key:
        for i,vertex in enumerate(key.data):
            f=(i//N)/(R-1);vertex.co=basis.data[i].co
            vertex.co.z+=sign*.004*abs(math.cos(angles[i%N]))**4*(1-f)**2
            if name=='smile':vertex.co.x=cx+(vertex.co.x-cx)*(1+.05*(1-f)**2)
tree=KDTree(len(body.data.vertices))
for vertex in body.data.vertices:tree.insert(vertex.co,vertex.index)
tree.balance();nearest=[tree.find(tuple(point)) for point in outer]
if max(item[2] for item in nearest)>1e-7:raise ValueError('Existing outer points do not exactly match body vertices')
ids=[item[1] for item in nearest];groups={group.name:group for group in patch.vertex_groups}
for i,vertex in enumerate(patch.data.vertices):
    f=(i//N)/(R-1);blend=smooth(f/.65);jaw=smooth(-math.sin(angles[i%N]))*.82*(1-f)**3
    weights={body.vertex_groups[g.group].name:g.weight*blend for g in body.data.vertices[ids[i%N]].groups}
    weights['head']=weights.get('head',0)+(1-jaw)*(1-blend);weights['jaw']=weights.get('jaw',0)+jaw*(1-blend)
    for group in list(vertex.groups):patch.vertex_groups[group.group].remove([i])
    for name,weight in weights.items():
        if name not in groups:groups[name]=patch.vertex_groups.new(name=name)
        if weight:groups[name].add([i],weight,'REPLACE')
for body_key in body.data.shape_keys.key_blocks:
    if body_key.name=='Basis':continue
    key=patch.data.shape_keys.key_blocks.get(body_key.name) or patch.shape_key_add(name=body_key.name)
    if body_key.name not in ('smile','frown'):
        for i,vertex in enumerate(key.data):
            f=(i//N)/(R-1);b=ids[i%N]
            vertex.co=basis.data[i].co+(body_key.data[b].co-body.data.shape_keys.key_blocks['Basis'].data[b].co)*smooth(f)
edges={tuple(sorted(e.vertices)) for e in body.data.edges}
connected=sum(tuple(sorted((a,b))) in edges for a,b in zip(ids,ids[1:]+ids[:1]))
patch['seam_body']=body.name;patch['seam_body_indices']=ids
patch['seam_patch_indices']=list(range((R-1)*N,R*N))
patch['boundary_matched']=connected==N;patch['seam_edge_topology_verified']=connected==N
patch['topology_revision']='V024_RADIAL_CANDIDATE';patch['production_approved']=False
patch.data.update();patch.data.calc_loop_triangles()
tri=np.array([t.vertices[:] for t in patch.data.loop_triangles]);points=np.array([v.co[:] for v in patch.data.vertices])
folds=int(np.count_nonzero(np.cross(points[tri[:,1]]-points[tri[:,0]],points[tri[:,2]]-points[tri[:,0]])[:,1]>1e-10))
if folds:raise ValueError(f'Radial annulus still has {folds} rest folds')
bpy.context.scene['production_approved']=False
bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()),compress=True)
atomic_json(destination.with_suffix('.radial-mouth.json'),{'source_sha256':digest(source),'candidate_sha256':digest(destination),
 'character':code,'blender':bpy.app.version_string,'ring_vertices':N,'rest_folded_front_triangles':folds,
 'body_geometry_changed':False,'outer_border_changed':False,'connected_body_edges':connected,
 'required_body_edges':N,'seam_topology_pass':connected==N,'production_approved':False})
