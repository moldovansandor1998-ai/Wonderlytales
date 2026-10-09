"""Resume a native SC001 render on twos, refusing mismatched source caches."""
import bpy,sys,json,time,hashlib
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v017';frames=out/'SC001_frames';frames.mkdir(exist_ok=True)
source=out/'S1E1_SC001_NATIVE_ACTING_V017.blend';digest=hashlib.sha256(source.read_bytes()).hexdigest();stamp=frames/'source.json'
if stamp.exists() and json.loads(stamp.read_text())['source_sha256']!=digest:raise RuntimeError('Source changed: preserve old frames and use a fresh render folder')
stamp.write_text(json.dumps({'source_sha256':digest,'native_fps':12,'delivery_fps':24,'expected_native_frames':800}))
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;s.render.use_persistent_data=True;s.render.use_sequencer=False
for o in s.objects:
 if o.type=='MESH' and any(m.type=='ARMATURE' and m.object and any(c in m.object.name for c in ['CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO']) for m in o.modifiers):o.hide_render=True
batch_limit=int(sys.argv[sys.argv.index('--')+2]) if len(sys.argv)>sys.argv.index('--')+2 else 800
new_frames=0
for i,f in enumerate(range(1,1601,2)):
 dest=frames/f'{i+1:04}.png'
 if dest.exists() and dest.stat().st_size>10000:continue
 s.frame_set(f);s.render.filepath=str(dest);t=time.time();bpy.ops.render.render(write_still=True)
 elapsed=round(time.time()-t,3);(out/'opening_render_progress.json').write_text(json.dumps({'rendered_through_native_frame':i+1,'native_frames_expected':800,'source_frame':f,'last_frame_seconds':elapsed,'source_sha256':digest,'episode_finished':False}))
 print('NATIVE_SC001_FRAME',i+1,f,elapsed,flush=True)
 new_frames+=1
 if new_frames>=batch_limit:break
print('SC001_BATCH_COMPLETE',new_frames,flush=True)
