"""Reopen a face fork, validate one artist pose and render its actual geometry."""
import bpy,sys,json,numpy as np
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
scene,out,pose=Path(args[0]),Path(args[1]),args[2]
bpy.ops.wm.open_mainfile(filepath=str(scene.resolve()))
s=bpy.context.scene;r=next(o for o in s.objects if o.type=='ARMATURE')
s.frame_set(1);r.animation_data.action=None
controls=['jaw_open','mouth_round','mouth_spread','mouth_press','smile','brow_raise','brow_worry','blink','gaze_yaw','gaze_pitch']
for p in controls:r[p]=0.
def coords(o):
    e=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=e.to_mesh();a=np.array([v.co[:] for v in m.vertices]);e.to_mesh_clear();return a
meshes=[o for o in s.objects if o.type=='MESH' and o.data.shape_keys]
r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();before={o.name:coords(o) for o in meshes}
poses={'neutral':{},'open':{'jaw_open':.8},'round':{'jaw_open':.45,'mouth_round':1.},'spread':{'jaw_open':.18,'mouth_spread':1.},'press':{'mouth_press':1.},'happy':{'smile':.9,'brow_raise':.45,'blink':.12},'worry':{'brow_worry':1.,'blink':.15}}
values=poses[pose]
for p,v in values.items():r[p]=v

# Explicitly invalidate scripted driver expressions after baseline evaluation.
for idblock in [r]+[o.data.shape_keys for o in meshes]:
 if idblock.animation_data:
  for fc in idblock.animation_data.drivers:fc.driver.expression=fc.driver.expression
r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
deltas={o.name:float(np.linalg.norm(coords(o)-before[o.name],axis=1).max()) for o in meshes}
if pose!='neutral':assert max(deltas.values())>.0002,(pose,deltas)
assert all(i.packed_file for i in bpy.data.images if i.type=='IMAGE')
assert all(x.packed_file for x in bpy.data.sounds)
body=next(o for o in meshes if o.vertex_groups.get('jaw') and len(o.data.vertices)>10000)
sums=[sum(g.weight for g in v.groups) for v in body.data.vertices]
assert min(sums)>.9999 and max(sums)<1.0001
out.mkdir(exist_ok=True,parents=True)
(out/(pose+'.json')).write_text(json.dumps({'pose':pose,'controls':values,'reopened':True,'maximum_mesh_deltas':deltas,'body_weight_range':[min(sums),max(sums)]},indent=2))
s.render.use_sequencer=False;s.render.filepath=str((out/(pose+'.png')).resolve())
bpy.ops.render.render(write_still=True)
print('POSE_CHECKED',pose)
