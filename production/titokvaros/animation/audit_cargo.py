"""Compare actual evaluated crate/body volumes across the full chase.
This only checks body-box intersections; it does not approve whole-body contact.
"""
import bpy,sys,argparse,json
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--blend',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(Path(a.blend).resolve()),use_scripts=False)
s=bpy.context.scene;collisions=[]
def box(obj,deps):
 evaluated=obj.evaluated_get(deps);points=[evaluated.matrix_world@Vector(x) for x in evaluated.bound_box];return [(min(x[i] for x in points),max(x[i] for x in points)) for i in range(3)]
for frame in range(361,602):
 s.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();crate=box(bpy.data.objects['cargo crate'],deps)
 for code in ['MIRA','BRUNO','KIPP']:
  body=box(bpy.data.objects[code+'_COAT'],deps);depth=[min(a[1],b[1])-max(a[0],b[0]) for a,b in zip(crate,body)]
  if min(depth)>.002:collisions.append({'frame':frame,'character':code,'axis_overlap_m':depth})
report={'source':Path(a.blend).name,'evaluated_frames':241,'colliding_samples':len(collisions),'collisions':collisions,'scope':'evaluated crate and torso AABBs only; fingers/wings/feet/acting not approved','production_approved':False};Path(a.out).write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='collisions'}))
