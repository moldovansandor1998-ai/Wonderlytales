"""Streaming film assembly with frozen clips/audio; media success grants no QC approval."""
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

def checked_object(client,bucket,key,sha,destination):
    if not re.fullmatch(r'(renders/native/S1E1|audio/S1E1)/[A-Za-z0-9_./-]+',key) or '..' in key:
        raise ValueError('Invalid film storage key')
    if not re.fullmatch(r'[a-f0-9]{64}',sha): raise ValueError('Checksum required')
    client.download_file(bucket,key,str(destination))
    with Path(destination).open('rb') as stream:
        if hashlib.file_digest(stream,'sha256').hexdigest()!=sha: raise RuntimeError('Film asset checksum mismatch')

def assemble_native(client,bucket,payload):
    clips=payload.get('clips',[]); frames=payload.get('frames')
    if type(frames) is not int or not 1<=frames<=24*60*180 or not 1<=len(clips)<=20000:
        raise ValueError('Invalid film assembly bounds')
    if sum(c['frames'] for c in clips)!=frames: raise ValueError('Assembly frame coverage mismatch')
    with tempfile.TemporaryDirectory(prefix='wonderly-assembly-') as tmp:
        root=Path(tmp); paths=[]
        for i,c in enumerate(clips):
            path=root/f'clip_{i:05d}.mp4';checked_object(client,bucket,c['key'],c['sha256'],path)
            subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'],check=True,capture_output=True,timeout=300)
            info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-of','json',str(path)]))['streams'][0]
            if int(info['nb_read_frames'])!=c['frames'] or info['r_frame_rate']!='24/1': raise RuntimeError('Film clip frame count/fps mismatch')
            if i and (info['width'],info['height'])!=size: raise RuntimeError('Mixed film clip dimensions')
            size=info['width'],info['height'];paths.append(path)
        audio=root/'mix.wav';checked_object(client,bucket,payload['audio_key'],payload['audio_sha256'],audio)
        audio_info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(audio)]))
        if abs(float(audio_info['format']['duration'])-frames/24)>1/48: raise RuntimeError('Hungarian full mix duration mismatch')
        listing=root/'concat.txt';listing.write_text(''.join("file '"+str(p)+"'\n" for p in paths))
        movie=root/'master.mp4'
        subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(listing),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(frames/24),'-movflags','+faststart',str(movie)],check=True,capture_output=True,timeout=1200)
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,r_frame_rate,nb_read_frames','-of','json',str(movie)]))['streams'][0]
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(movie),'-f','null','-'],check=True,capture_output=True,timeout=1200)
        if int(info['nb_read_frames'])!=frames: raise RuntimeError('Assembled film frame mismatch')
        with movie.open('rb') as stream: sha=hashlib.file_digest(stream,'sha256').hexdigest()
        identity=hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()
        key=f'renders/native/S1E1/assembled/{identity}/master.mp4'
        client.upload_file(str(movie),bucket,key,ExtraArgs={'ContentType':'video/mp4'})
        return {'status':'ASSEMBLED','frames':frames,'fps':24,'decoded':True,'production_approved':False,
                'audio_sha256':payload['audio_sha256'],'clip':{'key':key,'sha256':sha,'bytes':movie.stat().st_size,'verified_frames':frames,'verified_fps':24,'verified_width':size[0],'verified_height':size[1]}}
