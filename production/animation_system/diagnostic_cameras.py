"""Close and side native camera review, with unchanged performance/audio."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector,Quaternion
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json,smooth
source,dest,mode=sys.argv[sys.argv.index('--')+1:];source=Path(source);dest=Path(dest)
if dest.exists() or dest.resolve()==source.resolve():raise ValueError('Separate review file required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);s=bpy.context.scene;s.timeline_markers.clear()
data=bpy.data.cameras.new('V025 diagnostic camera');data.lens=65;data.dof.use_dof=False;camera=bpy.data.objects.new(data.name,data);s.collection.objects.link(camera);s.camera=camera;s.timeline_markers.new('V025 technical close/side review',frame=1).camera=camera
start,end=(1,192) if mode=='faces' else ((121,312) if mode=='gait' else (505,648))
for frame in range(start,end+1):
 s.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get()
 if mode=='faces':
  code='CHAR_LILI' if frame<=96 else 'CHAR_MARK';u=((frame-1)%96)/95
  rig=next(o for o in s.objects if o.type=='ARMATURE' and o.get('character_code')==code);ev=rig.evaluated_get(dep);head=ev.pose.bones['head'];transform=ev.matrix_world@head.matrix@head.bone.matrix_local.inverted()
  left=rig.data.bones['eye.L'].head_local;right=rig.data.bones['eye.R'].head_local;target=(left+right)*.5
  horizontal=(left-right).normalized();up=Vector((0,0,1));front=horizontal.cross(up).normalized();front=Quaternion(up,math.radians(60)*smooth(u))@front
  position=target+front*(.62 if code=='CHAR_LILI' else .55)+up*.025;target+=up*.005;position=transform@position;target=transform@target
 elif mode=='gait':
  rigs=[o.evaluated_get(dep) for o in s.objects if o.type=='ARMATURE' and o.get('character_code') in ('CHAR_MARK','CHAR_LILI')]
  target=sum((o.matrix_world.translation for o in rigs),Vector())/len(rigs)+Vector((0,0,.75));u=(frame-start)/(end-start)
  position=target+Quaternion(Vector((0,0,1)),.10*smooth(u))@Vector((3,-4.6,1.65));data.lens=42
 else:
  u=(frame-start)/(end-start);target=bpy.data.objects['PROP_STAR_SHARD'].evaluated_get(dep).matrix_world.translation
  offset=Quaternion(Vector((0,0,1)),math.radians(50)*smooth(u))@Vector((-.30,-.48,.28));position=target+offset
 camera.location=position;camera.rotation_euler=(target-position).to_track_quat('-Z','Y').to_euler();camera.keyframe_insert('location',frame=frame);camera.keyframe_insert('rotation_euler',frame=frame)
s.frame_set(start);dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
atomic_json(dest.with_suffix('.review.json'),{'source_sha256':digest(source),'candidate_sha256':digest(dest),'mode':mode,'frame_start':start,'frame_end':end,'original_motion_and_audio_preserved':True,'production_approved':False})
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100;s.render.use_sequencer=False
for frame in ((82,130,150) if mode=='faces' else ((168,240) if mode=='gait' else (560,630))):
 s.frame_set(frame);s.render.filepath=str(dest.parent/f'{mode}_{frame:04d}.png');bpy.ops.render.render(write_still=True)
