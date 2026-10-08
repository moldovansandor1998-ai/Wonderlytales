"""Reopen and verify scene boundaries, native geometry and actual speech rig."""
import bpy,sys,json,hashlib
from pathlib import Path
blend,report=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(blend.resolve()));s=bpy.context.scene
assert s.get('star_shape')=='BROKEN_FIVE_POINT_NATIVE_PROP'
assert len(bpy.data.objects['Story star shard'].data.vertices)==22
sound=next(x for x in bpy.data.sounds if x.packed_file)
packed_sha=hashlib.sha256(sound.packed_file.data).hexdigest()
assert packed_sha==hashlib.sha256((blend.parent/'opening_mix_DRAFT.wav').read_bytes()).hexdigest()
assert s.frame_end==600 and s.render.fps==24
assert (s.render.resolution_x,s.render.resolution_y)==(1920,1080)
mark=bpy.data.objects['CHAR_MARK_FILM_DRAFT']
assert len(bpy.data.objects['CHAR_MARK_NATIVE_BODY'].data.vertices)==270365
gate=next(o for o in s.objects if o.name.startswith('Gate pier'))
number=bpy.data.objects['Episode number only'];friend=bpy.data.objects['CHAR_MORZSI_NATIVE_BODY']
def state(f):
 s.frame_set(f);mark.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
 return {'frame':f,'gate_visible':not gate.hide_render,'number_visible':not number.hide_render,'friend_visible':not friend.hide_render,'jaw_angle':float(mark.pose.bones['jaw'].rotation_euler.x)}
states=[state(f) for f in [1,288,289,360,361,433,600]]
assert states[0]['gate_visible'] and states[3]['gate_visible'] and not states[4]['gate_visible']
assert not states[1]['number_visible'] and states[2]['number_visible'] and states[3]['number_visible'] and not states[4]['number_visible']
assert states[3]['friend_visible'] and not states[4]['friend_visible']
peak=0
for f in range(409,480):
 q=state(f);peak=max(peak,q['jaw_angle'])
assert peak>.05 and abs(states[-1]['jaw_angle'])<1e-5
Path(report).write_text(json.dumps({'reopened':True,'native_broken_star_vertices':22,'packed_audio_sha256':packed_sha,'intro_frames':360,'frame_count':600,'jaw_peak_angle':peak,'boundary_states':states,'production_approved':False,'phoneme_alignment':False,'lili_lipsync_ready':False,'full_episode_completed':False},indent=2))
print('OPENING_SCENE_QC_OK',peak)
