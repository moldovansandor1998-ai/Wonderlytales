"""Create an editable 60 s native quality-test extract, preserving accepted dialogue.

Blender --python build_quality_test.py -- ROOT prepare|finish
This is a measured development test, never an automatic cinematic approval.
"""
import bpy, sys, math, json, hashlib
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);mode=sys.argv[-1]
out=root/'episode-v018';start=243*24;first=start+1;last=start+1440
source=out/('STORY_LOOK_V018.blend' if mode=='prepare' else 'QUALITY_TEST_ACTING_V018.blend')
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
if mode=='prepare':
 s.frame_start=first;s.frame_end=last;s.frame_set(first)
 rig=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_MARK' in o.name);actor=rig.parent
 action=actor.animation_data.action
 curves=[action.fcurves.find('location',index=i) for i in range(3)]
 endpoint=Vector([fc.evaluate(first+60) for fc in curves]);initial=endpoint-Vector((0,2.8,0))
 final=Vector([fc.evaluate(first+120) for fc in curves])
 for axis,fc in enumerate(curves):
  values=[]
  for f in range(first,last+1,2):
   if f<=first+60:
    u=(f-first)/60;p=initial.lerp(endpoint,u)
   elif f<=first+120:
    u=(f-first-60)/60;u=u*u*(3-2*u);p=endpoint.lerp(final,u)
   else:p=Vector([x.evaluate(f) for x in curves])
   u=max(0,min(1,(f-first-60)/60));offset=-.4*(1-u*u*(3-2*u)) if f<=first+120 else 0
   values.append((f,p[axis]+(offset if axis==0 else 0)))
  fc.keyframe_points.clear();fc.keyframe_points.add(len(values));fc.keyframe_points.foreach_set('co',[v for pair in values for v in pair])
  for k in fc.keyframe_points:k.interpolation='LINEAR'
  fc.update()
 actor['run_start_frame']=first;actor['run_end_frame']=first+60
 # A full-body travelling camera exposes ground contact rather than hiding it.
 d=bpy.data.cameras.new('QUALITY_TEST full-body travel');cam=bpy.data.objects.new(d.name,d);s.collection.objects.link(cam);d.lens=40
 for f in range(first,first+240,2):
  u=(f-first)/240;target=Vector((0,2.8+u*1.2,.85));cam.location=target+Vector((-3.8+u*.5,-6.7,.9));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
  cam.keyframe_insert(data_path='location',frame=f);cam.keyframe_insert(data_path='rotation_euler',frame=f)
 for m in list(s.timeline_markers):
  if first<=m.frame<first+240:s.timeline_markers.remove(m)
 marker=s.timeline_markers.new('QUALITY_TEST walking and run',frame=first);marker.camera=cam;s.camera=cam
 # Counter-swing and forward body lean for the running insert.
 for f in range(first,first+62,2):
  phase=(f-first)/24*math.tau*2.3;fade=min(1,(f-first)/8,(first+60-f)/8)
  for side,shift in [('L',0),('R',math.pi)]:
   bone=rig.pose.bones['upper_arm.'+side];bone.rotation_euler.x=.55*math.sin(phase+shift)*fade;bone.keyframe_insert(data_path='rotation_euler',frame=f)
   bone=rig.pose.bones['forearm.'+side];bone.rotation_euler.x=.7*fade;bone.keyframe_insert(data_path='rotation_euler',frame=f)
 dest=out/'QUALITY_TEST_PREP_V018.blend'
else:
 # Retiming every action also moves the original mouth, material and VFX tracks.
 for action in bpy.data.actions:
  for fc in action.fcurves:
   for k in fc.keyframe_points:
    k.co.x-=start;k.handle_left.x-=start;k.handle_right.x-=start
 for m in s.timeline_markers:m.frame-=start
 for strip in s.sequence_editor.sequences_all if s.sequence_editor else []:strip.frame_start-=start
 s.frame_start=1;s.frame_end=1440;s.frame_set(1)
 s.render.resolution_x=1920;s.render.resolution_y=1080;s.render.resolution_percentage=100;s.render.fps=24
 s['quality_test']='Csodakapu 60 seconds; DEVELOPMENT REVIEW';s['production_approved']=False
 dest=out/'CSODAKAPU_60S_NATIVE_V018.blend'
 beats=json.loads((root/'episode-v016/S1E1_timeline_V016.json').read_text())['beats'];lines=[]
 for b in beats:
  if b.get('audio_start_frame',-1)>=first and b.get('audio_end_frame',1e12)<=last:
   lines.append({'character':b['character'],'text_hu':b['text_hu'],'start_sec':(b['audio_start_frame']-start)/24,'end_sec':(b['audio_end_frame']-start)/24,'audio_sha256':b['audio_sha256']})
 (out/'quality_test_manifest_V018.json').write_text(json.dumps({'duration_sec':60,'fps':24,'source_episode_start_sec':243,'characters':['CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO'],'dialogue':lines,'original_intro_preserved_in_episode':True,'render_stage':'DEVELOPMENT_REVIEW','reference_direct_comparison':'BLOCKED_YOUTUBE_COUNTRY_RESTRICTION','professional_quality_approved':False,'new_tripo_credits':0},ensure_ascii=False,indent=2))
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
print('QUALITY_TEST_NATIVE_SAVED',dest,flush=True)
