"""Prepare the first two current Hungarian recordings for a 25s opening draft."""
import json,subprocess,sys,math,hashlib
from pathlib import Path
import numpy as np
root,out=map(Path,sys.argv[1:]);root=root.resolve();out=out.resolve();out.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'current-episode-audio/manifest.json').read_text())['dialogue'][:2]
assert [r['character'] for r in rows]==['CHAR_MARK','CHAR_LILI']
start=17.;schedule=[]
for row in rows:
 p=root/'current-episode-audio'/row['file']
 raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','24000','pipe:1'])
 pcm=np.frombuffer(raw,dtype='<f4');duration=len(pcm)/24000
 rms=[float(np.sqrt(np.mean(pcm[i:i+1000]**2))) for i in range(0,len(pcm),1000)]
 peak=max(float(np.percentile(rms,95)),.005)
 values=[min(1,max(0,(r-.004)/(peak-.004))) for r in rms]
 schedule.append({**row,'absolute_path':str(p),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'start_sec':start,'duration_sec':duration,'envelope':values})
 start+=duration+.65
(out/'dialogue_schedule.json').write_text(json.dumps({'fps':24,'duration_sec':math.ceil(start+1),'intro_duration_sec':15,'dialogue':schedule},ensure_ascii=False,indent=2))
print('OPENING_SCHEDULE_SAVED',math.ceil(start+1))
