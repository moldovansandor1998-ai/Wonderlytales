"""Assemble exactly 1152 verified native frames and 48 s of actual sound.
Never pads, loops, interpolates, invents dialogue or approves artistic quality.
"""
import argparse,hashlib,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',default=str(Path(__file__).resolve().parents[1]));a=p.parse_args();root=Path(a.root);data=root/'data/titokvaros';render=data/'full_render';manifest=json.loads((root/'production/titokvaros/render-manifest.json').read_text());jobs=[j for j in manifest['jobs'] if j['id'].startswith('TV_DEMO_')];parts=[];next_frame=1
for job in jobs:
 if job['frame_start']!=next_frame:raise ValueError('Gap or overlap')
 next_frame=job['frame_end']+1
 status=json.loads((render/(job['id']+'.json')).read_text());clip=render/(job['id']+'.mp4')
 if status['status']!='COMPLETED' or hashlib.sha256(clip.read_bytes()).hexdigest()!=status['output']['clip']['sha256']:raise ValueError('Unverified source clip')
 parts.append(clip)
if next_frame!=1153:raise ValueError('Incomplete 48-second native timeline')
listing=render/'concat.txt';listing.write_text(''.join("file '"+str(x.resolve()).replace("'","'\\''")+"'\n" for x in parts));out=data/'TV_motion_review_V001.mp4';mix=data/'audio_stems/TV_sound_mix_V001.wav'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),'-i',str(mix),'-map','0:v:0','-map','1:a:0','-vf',"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='FEJLESZTÉSI MUNKAKÓPIA':fontsize=24:fontcolor=white@0.75:box=1:boxcolor=black@0.35:boxborderw=8:x=24:y=24",'-c:v','libx264','-crf','16','-preset','medium','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','48','-movflags','+faststart',str(out)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,codec_type,width,height,r_frame_rate,nb_read_frames,duration,sample_rate,channels:format=duration','-of','json',str(out)]));v=next(s for s in probe['streams'] if s['codec_type']=='video');aud=next(s for s in probe['streams'] if s['codec_type']=='audio')
if (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_frames']),float(v['duration']))!=(1920,1080,'24/1',1152,48.):raise ValueError('Final movie frame verification failed')
if aud['sample_rate']!='48000' or aud['channels']!=2 or abs(float(aud['duration'])-48)>.05:raise ValueError('Final movie sound verification failed')
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(out),'-f','null','-'],check=True)
report={'file':out.name,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'production_approved':False,'stage':'DEVELOPMENT_REVIEW','probe':probe,'source_jobs':[j['id'] for j in jobs],'source_sha256':jobs[0]['scene_sha256'],'sound_sha256':hashlib.sha256(mix.read_bytes()).hexdigest(),'native_frames':1152,'generated_or_duplicated_padding_frames':0,'visual_review':'PENDING','listening_review':'PENDING'}
(data/'final_media_audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
