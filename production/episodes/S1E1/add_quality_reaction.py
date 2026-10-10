"""A short accepted Hungarian gasp, retimed for the development extract only."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);out=root/'episode-v018';source=out/'CSODAKAPU_60S_NATIVE_V018.blend'
bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_MARK' in o.name)
# The carried-cloth wrist IK folds the source hoodie into the face in this
# close-up. Release it only during this reaction and return to the authored
# carrying pose afterward; do not alter the source character or other shots.
for side in ['L','R']:
 for name in ['upper_arm.','forearm.','hand.']:
  bone=rig.pose.bones[name+side];path=bone.path_from_id('rotation_euler')
  for axis in range(3):
   fc=rig.animation_data.action.fcurves.find(path,index=axis)
   before=fc.evaluate(264) if fc else bone.rotation_euler[axis]
   after=fc.evaluate(325) if fc else before
   if fc:
    for i in reversed(range(len(fc.keyframe_points))):
     if 265<=fc.keyframe_points[i].co.x<=324:fc.keyframe_points.remove(fc.keyframe_points[i])
   neutral=.16 if name=='forearm.' and axis==0 else 0.
   for f,value in [(264,before),(265,neutral),(324,neutral),(325,after)]:
    bone.rotation_euler[axis]=value;bone.keyframe_insert(data_path='rotation_euler',index=axis,frame=f)
  for con in bone.constraints:
   if con.type not in ['IK','COPY_ROTATION']:continue
   path=con.path_from_id('influence');fc=rig.animation_data.action.fcurves.find(path,index=0)
   before=fc.evaluate(264) if fc else con.influence;after=fc.evaluate(325) if fc else before
   if fc:
    for i in reversed(range(len(fc.keyframe_points))):
     if 265<=fc.keyframe_points[i].co.x<=324:fc.keyframe_points.remove(fc.keyframe_points[i])
   for f,value in [(264,before),(265,0.),(324,0.),(325,after)]:
    con.influence=value;con.keyframe_insert(data_path='influence',frame=f)
record=next(x for x in json.loads((root/'episode-v017/speech_motion_V017.json').read_text())['records'] if x['beat_id']=='mark_gasp')
start=277;offset=start-record['start_frame']
for marker in list(s.timeline_markers):
 if marker.name.startswith('QUALITY_TEST awed reaction') or marker.name.startswith('QUALITY_TEST reaction return'):s.timeline_markers.remove(marker)
for obj in list(s.objects):
 if obj.name.startswith('QUALITY_TEST Mark gasp closeup'):bpy.data.objects.remove(obj,do_unlink=True)
for prop in ['mouth_open','mouth_round','brow_raise','blink']:
 fc=rig.animation_data.action.fcurves.find('["'+prop+'"]',index=0)
 if fc:
  for i in reversed(range(len(fc.keyframe_points))):
   if 275<=fc.keyframe_points[i].co.x<=313:fc.keyframe_points.remove(fc.keyframe_points[i])
for prop,keys in [('mouth_open',record['open_keys']),('mouth_round',record['round_keys'])]:
 for frame,value in keys:
  f=frame+offset
  if 275<=f<=313:rig[prop]=value;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f)
 for f in [275,315]:rig[prop]=0;rig.keyframe_insert(data_path='["'+prop+'"]',frame=f)
for frame,amount in [(275,.08),(280,.62),(291,.8),(302,.55),(313,.10)]:
 rig['brow_raise']=amount;rig.keyframe_insert(data_path='["brow_raise"]',frame=frame)
for frame in [275,280,284,289,295,301,307,313]:
 rig['blink']=0;rig.keyframe_insert(data_path='["blink"]',frame=frame)
prior=max((m for m in s.timeline_markers if m.camera and m.frame<start),key=lambda m:m.frame).camera
data=bpy.data.cameras.new('QUALITY_TEST Mark gasp closeup');cam=bpy.data.objects.new(data.name,data);s.collection.objects.link(cam);data.lens=52
cavity=next(o for o in s.objects if 'CHAR_MARK' in o.name and 'MOUTH_CAVITY' in o.name)
for frame in range(265,326,2):
 s.frame_set(frame);ev=cavity.evaluated_get(bpy.context.evaluated_depsgraph_get());target=sum((ev.matrix_world@Vector(v) for v in ev.bound_box),Vector())/8+Vector((0,0,.17));yaw=rig.parent.rotation_euler.z
 cam.location=target+Vector((math.sin(yaw)*1.2,-math.cos(yaw)*1.2,.43));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert(data_path='location',frame=frame);cam.keyframe_insert(data_path='rotation_euler',frame=frame)
m=s.timeline_markers.new('QUALITY_TEST awed reaction',frame=265);m.camera=cam;m=s.timeline_markers.new('QUALITY_TEST reaction return',frame=325);m.camera=prior
s.frame_set(1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
(out/'quality_test_reaction_V018.json').write_text(json.dumps({'character':'CHAR_MARK','text_hu':'Hű!','performance_id':'mark_gasp','audio':'episode-v016/performances/mark_gasp.mp3','start_sec':(start-1)/24,'performance_reused':True,'original_episode_unchanged':True,'phoneme_alignment_verified':False},ensure_ascii=False,indent=2))
print('QUALITY_REACTION_INSERTED',flush=True)
