"""Actual inside/outside ray tests for retained fingers against closed prop parts."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from animation_system.spec import digest,atomic_json
source,registry,out=map(Path,sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;reg=json.loads(registry.read_text());body=bpy.data.objects[reg['characters']['CHAR_MARK']['body']];star=bpy.data.objects['PROP_STAR_SHARD'];groups={g.index:g.name for g in body.vertex_groups}
directions=[Vector(v).normalized() for v in ((1,.371,.217),(.237,1,.619),(.419,.173,1))]
def inside(tree,point):
    votes=0
    for direction in directions:
        origin=point.copy();hits=0
        for _ in range(64):
            hit,_,_,_=tree.ray_cast(origin,direction,10.)
            if hit is None:break
            hits+=1;origin=hit+direction*.000001
        votes+=hits%2
    return votes>=2
report={'source_sha256':digest(source),'frames':[],'production_approved':False}
for frame in (560,700,1153):
    scene.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get();trees=[];unclosed=[]
    for part in [star]+list(star.children_recursive):
        if part.type!='MESH' or part.hide_render:continue
        ev=part.evaluated_get(dep);mesh=ev.to_mesh();edges={}
        for polygon in mesh.polygons:
            ids=list(polygon.vertices)
            for a,b in zip(ids,ids[1:]+ids[:1]):key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
        if any(n!=2 for n in edges.values()):unclosed.append(part.name)
        else:trees.append(BVHTree.FromPolygons([ev.matrix_world@v.co for v in mesh.vertices],[p.vertices[:] for p in mesh.polygons]))
        ev.to_mesh_clear()
    ev=body.evaluated_get(dep);mesh=ev.to_mesh();result={'frame':frame,'closed_prop_parts':len(trees),'unclosed_prop_parts':unclosed,'inside_hand_vertices':0,'max_depth_m':0.,'digit_min_gap_m':{}}
    for original in body.data.vertices:
        names=[groups[g.group] for g in original.groups if g.weight>.10 and (groups[g.group]=='hand.L' or (groups[g.group].startswith('finger_') and groups[g.group].endswith('.L')))]
        if not names:continue
        point=ev.matrix_world@mesh.vertices[original.index].co
        for tree in trees:
            _,_,_,distance=tree.find_nearest(point)
            if distance is None or distance>.025:continue
            for name in names:
                digit=name.split('_')[1] if name.startswith('finger_') else 'palm'
                result['digit_min_gap_m'][digit]=min(result['digit_min_gap_m'].get(digit,1.),distance)
            if distance>.0005 and inside(tree,point):result['inside_hand_vertices']+=1;result['max_depth_m']=max(result['max_depth_m'],distance)
    ev.to_mesh_clear();report['frames'].append(result)
report['closed_prop_geometry_verified']=all(not f['unclosed_prop_parts'] and f['closed_prop_parts'] for f in report['frames'])
report['sampled_penetration_pass']=report['closed_prop_geometry_verified'] and max(f['max_depth_m'] for f in report['frames'])<.002
atomic_json(out,report);print(json.dumps(report),flush=True)
