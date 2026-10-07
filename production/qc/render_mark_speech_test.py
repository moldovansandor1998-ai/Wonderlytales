"""Render an explicit amplitude-driven native face test, using fresh Blender processes.
Usage: python render_mark_speech_test.py BLENDER SCENE ENVELOPE OUTPUT_DIR
Frames are never reused; output is a labeled technical draft with recorded audio.
"""
import sys,subprocess,json,concurrent.futures,hashlib,time
from PIL import Image
from pathlib import Path
blender=Path(sys.argv[1]).resolve();scene=Path(sys.argv[2]).resolve();env=json.loads(Path(sys.argv[3]).read_text());out=Path(sys.argv[4]).resolve();out.mkdir(parents=True,exist_ok=True)
assert blender.is_file() and scene.is_file() and env['phoneme_alignment'] is False
frames=out/'speech_frames';frames.mkdir(exist_ok=True)
assert not any(frames.glob('*.png')), 'Use a fresh frame directory; never reuse stale facial frames.'
def render(frame):
    path=frames/('frame_%04d.png'%frame)
    expression=('import bpy; s=bpy.context.scene; r=next(o for o in s.objects if o.type=="ARMATURE"); '
       f's.frame_set({frame}); r.update_tag(refresh={{"OBJECT"}}); bpy.context.view_layer.update(); '
       f's.render.filepath={str(path)!r}; s.render.use_sequencer=False; '
       'bpy.ops.render.render(write_still=True); print("SPEECH_FRAME_OK")')
    log=frames/('frame_%04d.log'%frame)
    with log.open('w') as f:
        subprocess.run([str(blender),'-b','-t','2',str(scene),'--python-expr',expression],stdout=f,stderr=subprocess.STDOUT,check=True)
    deadline=time.monotonic()+30
    while not path.is_file() and time.monotonic()<deadline:time.sleep(.2)
    assert path.is_file(), 'Render failed: '+str(log)
    with Image.open(path) as im:im.verify()
    return frame
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for n,frame in enumerate(pool.map(render,range(1,env['frame_count']+1)),1):
        if n%12==0 or n==env['frame_count']:print('Rendered',n,'/',env['frame_count'],flush=True)
duration=env['frame_count']/24
video=out/'Wonderly_Tales_Mark_beszedproba_DRAFT.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-i',str(frames/'frame_%04d.png'),'-i',env['audio_path'],
 '-filter_complex',f'[0:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text=ARCMOZGAS-PROBA:fontcolor=white:fontsize=13:x=12:y=12:box=1:boxcolor=black@0.5[v];[1:a]adelay=500:all=1,apad,atrim=duration={duration}[a]',
 '-map','[v]','-map','[a]','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-movflags','+faststart','-t',str(duration),str(video)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(video)]))
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
assert int(v['nb_read_frames'])==env['frame_count'] and v['r_frame_rate']=='24/1' and a['sample_rate']=='48000'
subprocess.run(['ffmpeg','-v','error','-i',str(video),'-f','null','-'],check=True)
(out/'speech_video_validation.json').write_text(json.dumps({'status':'DECODE_AND_TIMING_CHECKED_DRAFT','frames':int(v['nb_read_frames']),'fps':24,'duration_sec':duration,'audio_offset_sec':.5,'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'video_resolution':[v['width'],v['height']],'phoneme_alignment':False,'production_approved':False},indent=2))
print('SPEECH_VIDEO_READY',video,flush=True)
