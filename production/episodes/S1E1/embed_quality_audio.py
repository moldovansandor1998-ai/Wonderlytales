"""Pack the measured trial sound mix into its editable native scene."""
import bpy,sys,json,hashlib
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]);out=root/'episode-v018';source=out/'CSODAKAPU_60S_NATIVE_V018.blend';visual_hash=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);s=bpy.context.scene;editor=s.sequence_editor_create()
for strip in list(editor.strips):
 if strip.type=='SOUND':editor.strips.remove(strip)
for sound in list(bpy.data.sounds):
 if sound.users==0:bpy.data.sounds.remove(sound)
strip=editor.strips.new_sound('QUALITY_TEST Hungarian final mix',str(out/'QUALITY_TEST_final_audio_V018.wav'),channel=1,frame_start=1);strip.sound.pack();strip.volume=1
s.render.use_sequencer=False;s.frame_start=1;s.frame_end=1440;s.frame_set(1)
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
(out/'quality_test_source_provenance_V018.json').write_text(json.dumps({'visual_scene_sha256':visual_hash,'packed_scene_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'audio_sha256':hashlib.sha256((out/'QUALITY_TEST_final_audio_V018.wav').read_bytes()).hexdigest(),'change':'Pack final 60-second audio, remove unused full-episode audio; geometry and animation unchanged','production_approved':False},indent=2))
print('QUALITY_AUDIO_PACKED',flush=True)
