"""Read-only visual sampling of completed frozen clips at each shot midpoint."""
import argparse,json,pathlib,subprocess,math
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=pathlib.Path);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];checkpoint=json.loads((root/'ops/v024-opening-storage-review.json').read_text());dest=args.output_dir or root/'data/V024/review-stills';dest.mkdir(parents=True,exist_ok=True);rows=[]
for scene,offset in [('SC001',0),('SC003',58)]:
 d=json.loads((root/f'production/episodes/S1E1/feature_V002/quality_opening_V024/S1E1_{scene}_V024.script.json').read_text())
 for i,cam in enumerate(d['cameras']):
  end=d['cameras'][i+1]['start'] if i+1<len(d['cameras']) else d['duration'];t=(cam['start']+end)/2;frame=math.floor(t*24)+1
  job=next((j for j in checkpoint['jobs'] if j['scene_id']==f'S1E1_{scene}_V024' and j['input']['frame_start']<=frame<=j['input']['frame_end']),None)
  if not job or job['artifact_status']!='DECODED':continue
  filename=f'{offset+t:07.3f}_{scene}_{i+1:02d}.jpg';local=(frame-job['input']['frame_start'])/24
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(local),'-i',str(root/'data/V024/storage_review'/(job['id']+'.mp4')),'-frames:v','1','-vf','scale=960:540','-q:v','2','-y',str(dest/filename)],check=True)
  rows.append({'scene':scene,'shot':i+1,'global_sec':offset+t,'frame':frame,'file':filename,'source_clip_sha256':job['sha256']})
(dest/'index.json').write_text(json.dumps(rows,indent=2)+'\n');print(json.dumps({'frames':len(rows),'last_sec':rows[-1]['global_sec'] if rows else None}))
