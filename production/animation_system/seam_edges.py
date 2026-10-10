"""Remove only collinear cut vertices inserted into an already matched seam."""
import bpy,bmesh
from mathutils import Vector
from mathutils.kdtree import KDTree


def coalesce_existing_seams(body):
    seams=[o for o in bpy.data.objects if o.get('seam_body')==body.name]
    original={o.name:[body.data.vertices[i].co.copy() for i in o['seam_body_indices']] for o in seams}
    protected={i for o in seams for i in o['seam_body_indices']}
    bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();remove=set()
    for patch in seams:
        ids=list(patch['seam_body_indices'])
        for ia,ib in zip(ids,ids[1:]+ids[:1]):
            a,b=bm.verts[ia],bm.verts[ib]
            if bm.edges.get((a,b)):continue
            axis=b.co-a.co;length=axis.length_squared
            frontier=[(a,[])];seen={a};found=None
            while frontier:
                vertex,path=frontier.pop(0)
                if vertex==b:found=path[:-1];break
                for edge in vertex.link_edges:
                    if not edge.is_boundary:continue
                    other=edge.other_vert(vertex)
                    if other in seen:continue
                    u=(other.co-a.co).dot(axis)/length
                    if -.00001<=u<=1.00001 and (other.co-a.co-axis*u).length<1e-6:
                        seen.add(other);frontier.append((other,path+[other]))
            if found is None or any(v.index in protected for v in found):
                raise ValueError('Previously matched seam no longer has a collinear boundary path')
            remove.update(found)
    count=len(remove)
    if remove:bmesh.ops.dissolve_verts(bm,verts=list(remove),use_face_split=False,use_boundary_tear=False)
    bm.to_mesh(body.data);bm.free();body.data.update()
    tree=KDTree(len(body.data.vertices))
    for vertex in body.data.vertices:tree.insert(vertex.co,vertex.index)
    tree.balance()
    for patch in seams:
        matches=[tree.find(co) for co in original[patch.name]]
        if max(q[2] for q in matches)>1e-6:raise ValueError('Seam position changed while coalescing cut edges')
        patch['seam_body_indices']=[q[1] for q in matches]
    return {'collinear_inserted_vertices_dissolved':count,'original_boundary_positions_preserved':True}
