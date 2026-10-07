import bpy,sys,json,hashlib
from pathlib import Path
scene,track,out=[Path(x).resolve() for x in sys.argv[sys.argv.index('--')+1:]]
data=json.loads(track.read_text());bpy.ops.wm.open_mainfile(filepath=str(scene));s=bpy.context.scene
r=next(o for o in s.objects if o.type=='ARMATURE');assert r.animation_data.action and r.animation_data.drivers
assert s.frame_end==97 and s.render.fps==24 and s.render.fps_base==1
sound=next(x for x in bpy.data.sounds if x.packed_file);sha=hashlib.sha256(sound.packed_file.data).hexdigest()
assert sha==data['audio_sha256']=='fb467588f48ffb37da24f49d27cef583d4cdf48c826ade1e4430dab901a7ef29'
strip=next(x for x in s.sequence_editor.strips if x.type=='SOUND');assert strip.frame_start==13 and strip.sound.packed_file
maximum=0.
for pose in data['frames']:
 s.frame_set(pose['frame']);r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
 for key,value in pose['controls'].items():maximum=max(maximum,abs(float(r[key])-value))
assert maximum<.00001,maximum
assert all(i.packed_file for i in bpy.data.images if i.type=='IMAGE')
out.write_text(json.dumps({'freshly_reopened':True,'native_control_frames_checked':97,'maximum_control_error':maximum,'packed_audio_sha256':sha,'sound_strip_frame_start':13,'textures_packed':True,'phoneme_alignment':False,'production_approved':False},indent=2))
print('PORTABLE_HUNGARIAN_ACTING_CHECKED',maximum)
