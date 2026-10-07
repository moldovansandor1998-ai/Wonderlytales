import bpy,sys,json,math
from pathlib import Path
scene,out=[Path(x).resolve() for x in sys.argv[sys.argv.index('--')+1:]]
bpy.ops.wm.open_mainfile(filepath=str(scene));r=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
r.animation_data.action=None
worst=-1.;tested=0
for k in range(101):
 r['blink']=k/100
 for side in ['R','L']:
  lid=bpy.data.objects['EYELIDS.'+side]
  for fc in lid.data.shape_keys.animation_data.drivers:fc.driver.expression=fc.driver.expression
 r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
 for side,cx,cy in [('R',-.034,-.1068039983510971),('L',.034,-.10598115622997284)]:
  obj=bpy.data.objects['EYELIDS.'+side].evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=obj.to_mesh()
  for v in mesh.vertices:
   rem=.018**2-(v.co.x-cx)**2-((v.co.z-.8220000267028809)/.86)**2
   if rem>0:
    penetration=v.co.y-(cy-math.sqrt(rem));worst=max(worst,penetration);tested+=1
  obj.to_mesh_clear()
out.write_text(json.dumps({'sampled_blink_positions':101,'tested_projected_vertices':tested,'worst_eye_surface_offset':worst,'no_vertex_penetration':worst<0,'production_approved':False},indent=2))
assert worst<0,(worst,tested)
print('LID_CLEARANCE_CHECKED',worst,tested)
