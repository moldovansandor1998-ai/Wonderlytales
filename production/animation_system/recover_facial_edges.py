"""Recover locally missing triangular faces from edges retained by FACES_ONLY.

Uses only the current source's native vertices and edges. No whole-character
replacement, external model, global remesh, or invented long bridging edge.
Texture coordinates are retained from incident loops where present; otherwise
sampled from the closest retained surface and explicitly reported.
"""
import bpy,bmesh
from mathutils import Vector
from mathutils.geometry import barycentric_transform
from .facial import Surface
from .spec import FACE_PROFILES


def recover_eye_faces(body,rig,code):
    surf=Surface(body);bm=bmesh.new();bm.from_mesh(body.data);bm.verts.ensure_lookup_table();bm.verts.index_update()
    eyes=FACE_PROFILES[code]['eyes']
    def nearby(v):
        return any(((v.co.x-x)/(w*1.5))**2+((v.co.z-z)/(h*1.5))**2<1 and v.co.y<rig.data.bones['eye.'+side].head_local.y+.07 for side,(x,z,w,h) in zip(('R','L'),eyes))
    candidates=set();existing={tuple(sorted(v.index for v in f.verts)) for f in bm.faces if len(f.verts)==3}
    for a in bm.verts:
        if not nearby(a):continue
        neighbors={e.other_vert(a) for e in a.link_edges}
        for b in neighbors:
            if b.index<=a.index:continue
            for edge in b.link_edges:
                c=edge.other_vert(b)
                if c.index<=b.index or c not in neighbors:continue
                key=(a.index,b.index,c.index)
                if key not in existing:candidates.add(key)
    uv=bm.loops.layers.uv.active;known={v.index:next((loop[uv].uv.copy() for loop in v.link_loops),None) for v in bm.verts}
    fallback=0;added=0;largest=0.
    for key in sorted(candidates):
        vertices=[bm.verts[i] for i in key]
        a,b,c=(v.co for v in vertices);area=(b-a).cross(c-a).length*.5
        if area<1e-10:continue
        if max((a-b).length,(b-c).length,(c-a).length)>.06:continue
        # Follow the existing face orientation at shared edges when available.
        reverse=None
        for a,b in zip(vertices,vertices[1:]+vertices[:1]):
            edge=bm.edges.get((a,b))
            if len(edge.link_faces)==1:
                loop=next(l for l in edge.link_faces[0].loops if l.edge==edge)
                reverse=loop.vert==a;break
        if reverse is None:reverse=(vertices[1].co-vertices[0].co).cross(vertices[2].co-vertices[0].co).y>0
        if reverse:vertices.reverse()
        face=bm.faces.new(vertices);face.smooth=True;added+=1;largest=max(largest,area)
        for loop in face.loops:
            original=known[loop.vert.index]
            if original is not None:loop[uv].uv=original
            else:
                point,_,index,_=surf.tree.find_nearest(loop.vert.co)
                tex=barycentric_transform(point,*[surf.v[j] for j in surf.tri[index]],*surf.uv[index]);loop[uv].uv=(tex.x,tex.y);fallback+=1
    bm.to_mesh(body.data);bm.free();body.data.update()
    return {'recovered_triangle_cycles':added,'sampled_uv_corners':fallback,'largest_recovered_triangle_area':largest,'vertices_moved':0,'new_edges_invented':False,'production_approved':False}
