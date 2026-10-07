"""Artist-authored syllable/expression draft, explicitly without validated alignment.
Uses the recorded speech envelope and adds lip rounding/spread and acting cues.
Blender -b --python animate_mark_face.py -- FACE ENVELOPE OUTPUT
"""
import bpy,json,sys,math,hashlib
from pathlib import Path
face,ep,out=[Path(x).resolve() for x in sys.argv[sys.argv.index('--')+1:]]
assert not (out/'CHAR_MARK_ACTING_V011_DRAFT.blend').exists(), 'Choose a fresh output directory; preserve existing acting work.'
env=json.loads(ep.read_text());assert env['audio_sha256']==hashlib.sha256(Path(env['audio_path']).read_bytes()).hexdigest()=='fb467588f48ffb37da24f49d27cef583d4cdf48c826ade1e4430dab901a7ef29'
assert hashlib.sha256(face.read_bytes()).hexdigest()=='1c93a215a3ff6e251e90c6a9c7662f7fd094433f45f57c618052b17b1ca0a284'
bpy.ops.wm.open_mainfile(filepath=str(face));s=bpy.context.scene
r=next(o for o in s.objects if o.type=='ARMATURE')
assert r.name.startswith('CHAR_MARK') and s.get('status')=='DRAFT_EYELID_REFINEMENT_NOT_APPROVED', 'Use only the authored Mark expression draft.'
assert all(k in r for k in ['mouth_spread','mouth_press','smile','brow_raise','brow_worry'])
assert r.animation_data and r.animation_data.drivers, 'Native facial drivers are required.'
r.animation_data.action=None
def pulse(t,center,width):return max(0.,1-abs(t-center)/width)
frames=[]
for frame,amplitude in enumerate(env['jaw_values'],1):
 t=((frame-1)/24-.5)*(2.786416/env['duration_sec'])
 # These vowel centers are manual initial estimates, not measured alignment.
 rounded=max(pulse(t,c,w) for c,w in [(.32,.16),(1.05,.12),(1.27,.13),(1.43,.15),(2.47,.21)])
 spread=max(pulse(t,c,w) for c,w in [(.13,.12),(1.64,.10),(1.83,.12),(2.05,.12),(2.24,.12)])
 blink=max(pulse(t,.77,.08),pulse(t,2.8,.10))
 vals={'jaw_open':.68*amplitude,'mouth_round':.70*rounded,'mouth_spread':.60*spread,'mouth_press':0.,'smile':.12+.15*max(0,min(1,t/2.7)),'brow_raise':.25*max(0,1-abs(t-.16)/.6),'brow_worry':0.,'blink':.10+.85*blink,'gaze_yaw':-3.0*max(0,1-abs(t-.76)/.35),'gaze_pitch':0.}
 for prop,value in vals.items():r[prop]=value;r.keyframe_insert(data_path='["'+prop+'"]',frame=frame)
 head=r.pose.bones['head'];head.rotation_mode='XYZ';head.rotation_euler.x=.015*math.sin(max(0,t)*3);head.rotation_euler.z=.012*math.sin(max(0,t)*2)
 head.keyframe_insert(data_path='rotation_euler',frame=frame)
 frames.append({'frame':frame,'controls':vals})
for fc in r.animation_data.action.fcurves:
 for p in fc.keyframe_points:p.interpolation='LINEAR'
s.frame_start=1;s.frame_end=env['frame_count'];s.render.fps=24;s.cycles.samples=4;s.render.resolution_x=320;s.render.resolution_y=320;s.render.resolution_percentage=100
s['recognized_audio_text']=env['recognized_text'];s['recognized_audio_language']=env['recognized_language'];s['speech_test']='Manual estimated vowel cues plus RMS jaw and expression draft; alignment not validated'
s.frame_set(1)
for idblock in [r]+[o.data.shape_keys for o in s.objects if o.type=='MESH' and o.data.shape_keys]:
 if idblock.animation_data:
  for fc in idblock.animation_data.drivers:fc.driver.expression=fc.driver.expression
r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
out.mkdir(parents=True,exist_ok=True);dest=out/'CHAR_MARK_ACTING_V011_DRAFT.blend'
se=s.sequence_editor_create();se.strips.new_sound('Checked Hungarian D001',env['audio_path'],channel=1,frame_start=13);s.render.use_sequencer=False;s.sync_mode='AUDIO_SYNC';bpy.ops.file.pack_all()
# Recover the pinned recording from packed bytes for portable render checkpoints.
recording=next(x for x in bpy.data.sounds if x.packed_file).packed_file.data
assert hashlib.sha256(recording).hexdigest()==env['audio_sha256']
(out/'recorded_hu_line.mp3').write_bytes(recording)
env['audio_path']=str(out/'recorded_hu_line.mp3')
(out/'audio_envelope.json').write_text(json.dumps(env,indent=2))
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
(out/'manual_expression_track.json').write_text(json.dumps({'character':'CHAR_MARK','version':'V011','fps':24,'frame_count':len(frames),'audio_sha256':env['audio_sha256'],'audio_offset_sec':.5,'alignment_method':'MANUAL_VOWEL_CENTERS_INITIAL_ESTIMATE','phoneme_alignment':False,'alignment_verified':False,'production_approved':False,'frames':frames},indent=2))
(out/'acting_manifest.json').write_text(json.dumps({'face_source_sha256':hashlib.sha256(face.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'frames':len(frames),'phoneme_alignment':False,'quality_gate_passed':False},indent=2))
print('ACTING_DRAFT_SAVED')
