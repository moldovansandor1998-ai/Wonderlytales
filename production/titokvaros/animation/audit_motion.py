"""Evaluate IK contact in the saved Blender scene; never equate metrics to art QA."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from assemble_demo import path
blend,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=str(Path(blend).resolve()),use_scripts=False)
s=bpy.context.scene;report={'production_approved':False,'gait':{},'hand_contact':{},'note':'Numerical evidence complements a complete video review, never replaces it.'}
for i,code in enumerate(['MIRA','BRUNO','KIPP']):
 r=bpy.data.objects['TV_CHAR_'+code+'_RIG'];prev={};errors=[];ground=[]
 for frame in range(1,121):
  s.frame_set(frame);bpy.context.view_layer.update();t=(frame-1)/24;y,speed,mode,distance=path(t)
  for side,offset in [('L',0),('R',.5)]:
   phase=(distance/.48+i*.18+offset)%1
   foot=r.matrix_world@r.pose.bones['DEF-foot.'+side].head
   if .04<phase<.58:
    if side in prev and prev[side][0]==frame-1:errors.append((foot-prev[side][1]).length)
    prev[side]=(frame,foot.copy());ground.append(foot.z)
   else:prev.pop(side,None)
 report['gait'][code]={'max_planted_frame_displacement_m':max(errors,default=0),'samples':len(errors),'foot_bone_height_range_m':[min(ground),max(ground)],'planted_displacement_gate':max(errors,default=99)<.004}
r=bpy.data.objects['TV_CHAR_BRUNO_RIG']
for side,sign in [('L',1),('R',-1)]:
 errors=[]
 for f in range(625,889,8):
  s.frame_set(f);bpy.context.view_layer.update();hand=r.matrix_world@r.pose.bones['DEF-hand.'+side].tail;target=Vector((.35+sign*.44,-7.75+.38,1.15));errors.append((hand-target).length)
 report['hand_contact'][side]={'max_wrist_to_authored_grip_error_m':max(errors),'wrist_gate':max(errors)<.025,'finger_surface_collision_review':'PENDING'}
Path(out).write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
