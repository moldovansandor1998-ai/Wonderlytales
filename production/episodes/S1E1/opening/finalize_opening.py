"""Encode the complete native draft, split the 15s intro and verify both files."""
import json,sys,subprocess,time,hashlib
from pathlib import Path
import numpy as np
from PIL import Image
out=Path(sys.argv[1]).resolve();frames=out/'final_frames';expected=[f'frame_{i:04d}.png' for i in range(1,600,2)]
if '--watch' in sys.argv:
 while True:
  ready=sum((frames/n).exists() for n in expected)
  if ready==300:
   try:
    with Image.open(frames/expected[-1]) as im:im.verify()
    break
   except (OSError,SyntaxError):pass
  print('WAITING_FOR_NATIVE_FRAMES',ready,300,flush=True);time.sleep(5)
assert sorted(p.name for p in frames.glob('*.png'))==expected
for name in expected:
 with Image.open(frames/name) as im:
  assert im.size==(1920,1080);im.verify()
movie=out/'Wonderly_Tales_S1E1_intro_es_nyitojelenet_V001_DRAFT.mp4'
intro=out/'Wonderly_Tales_15mp_intro_V001_DRAFT.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-framerate','12','-pattern_type','glob','-i',str(frames/'frame_*.png'),'-i',str(out/'opening_mix_DRAFT.wav'),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-r','24','-c:a','aac','-b:a','192k','-t','25','-movflags','+faststart',str(movie)],check=True)
subprocess.run(['ffmpeg','-y','-v','error','-i',str(movie),'-t','15','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(intro)],check=True)
reports=[]
for path,duration,count in [(movie,25,600),(intro,15,360)]:
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(path)]))
 video=next(x for x in probe['streams'] if x['codec_type']=='video');audio=next(x for x in probe['streams'] if x['codec_type']=='audio')
 assert (video['width'],video['height'])==(1920,1080)
 assert video['r_frame_rate']=='24/1' and int(video['nb_read_frames'])==count
 assert abs(float(video['duration'])-duration)<.05
 subprocess.run(['ffmpeg','-v','error','-i',str(path),'-f','null','-'],check=True)
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-vn','-f','f32le','pipe:1'])
 peak=float(np.abs(np.frombuffer(raw,dtype='<f4')).max());assert peak<1
 reports.append({'file':path.name,'duration_sec':float(video['duration']),'frame_count':count,'fps':24,'resolution':[1920,1080],'audio_channels':audio['channels'],'audio_peak':peak,'fully_decoded':True,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(out/'movie_QC.json').write_text(json.dumps({'status':'VERIFIED_DRAFT_ENCODING','unique_native_motion_phases':300,'source_motion_phases_per_sec':12,'output_fps':24,'animation_style':'DRAFT_ON_TWOS','artistic_quality_gate_passed':False,'full_episode_completed':False,'outputs':reports},indent=2))
print('OPENING_MOVIE_VERIFIED',json.dumps(reports),flush=True)
