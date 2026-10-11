"""Read-only reconciliation of the fixed Titokvaros render jobs and clip hashes.
Never submits or retries jobs; authenticated Studio owns budget and claims.
"""
import argparse,json,hashlib,urllib.request,subprocess
from pathlib import Path
import boto3
p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('--download',action='store_true');p.add_argument('--diagnostics',action='store_true');a=p.parse_args()
root=Path(__file__).resolve().parents[1];c=json.loads(Path(a.config).read_text());m=json.loads((root/'production/titokvaros/render-manifest.json').read_text())
s=boto3.client('s3',endpoint_url=c['S3_ENDPOINT'],aws_access_key_id=c['S3_ACCESS_KEY_ID'],aws_secret_access_key=c['S3_SECRET_ACCESS_KEY'],region_name='auto');out=root/'data/titokvaros/full_render';out.mkdir(exist_ok=True,parents=True)
summary=[]
for job in m['jobs']:
 if not (job['id'].startswith('TV_DEMO_') or (a.diagnostics and job['id'].startswith('TV_CONTACT_'))):continue
 try:state=json.loads(s.get_object(Bucket=c['S3_BUCKET'],Key='native/S1E1/TITOKVAROS/V001/jobs/'+job['id']+'.json')['Body'].read())
 except s.exceptions.NoSuchKey:summary.append({'id':job['id'],'status':'NOT_SUBMITTED'});continue
 if not state.get('provider_job_id'):summary.append({'id':job['id'],'status':state['status']});continue
 cached=out/(job['id']+'.json');d=json.loads(cached.read_text()) if cached.exists() else {}
 if d.get('status')!='COMPLETED':
  req=urllib.request.Request('https://api.runpod.ai/v2/cfog2x4xsd0adz/status/'+state['provider_job_id'],headers={'Authorization':'Bearer '+c['RUNPOD_API_KEY']})
  with urllib.request.urlopen(req,timeout=30) as r:d=json.load(r)
  cached.write_text(json.dumps(d,indent=2))
 row={'id':job['id'],'provider_job_id':state['provider_job_id'],'status':d['status'],'execution_ms':d.get('executionTime')}
 if d.get('error'):row['error']=str(d['error'])[:1000]
 if d['status']=='COMPLETED':
  o=d['output'];clip=o['clip'];count=job['frame_end']-job['frame_start']+1
  if (o['status'],o['source_sha256'],o['renderer_revision'],o['frames'],o['frame_start'],o['frame_end'],o['fps'],o['width'],o['height'],len(o['outputs']))!=('RENDERED',job['scene_sha256'],m['renderer_revision'],count,job['frame_start'],job['frame_end'],24,1920,1080,count):raise ValueError('Wrong completed render evidence')
  if not clip['key'].startswith('renders/native/S1E1/'+job['scene_sha256']+'/'):raise ValueError('Wrong output namespace')
  row.update(frames=count,has_audio=clip.get('has_scene_audio'),clip_sha256=clip['sha256'])
  if a.download:
   path=out/(job['id']+'.mp4')
   if not path.exists():s.download_file(c['S3_BUCKET'],clip['key'],str(path))
   if hashlib.sha256(path.read_bytes()).hexdigest()!=clip['sha256']:raise ValueError('Downloaded clip hash mismatch')
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_type,width,height,r_frame_rate,nb_read_frames,duration','-of','json',str(path)]));video=next(x for x in info['streams'] if x['codec_type']=='video')
   if (video['width'],video['height'],video['r_frame_rate'],int(video['nb_read_frames']))!=(1920,1080,'24/1',count):raise ValueError('Local media verification failed')
   row['download_verified']=True
 else:
  source={k:job.get(k,m.get(k)) for k in ['scene_key','scene_sha256']};source.update(operation='RENDER_NATIVE_FRAMES',frame_start=job['frame_start'],frame_end=job['frame_end'],width=1920,height=1080,samples=48,renderer_revision=m['renderer_revision'])
  ident=hashlib.sha256(json.dumps(source,sort_keys=True).encode()).hexdigest()
  objects=s.list_objects_v2(Bucket=c['S3_BUCKET'],Prefix=f"renders/native/S1E1/{source['scene_sha256']}/{ident}/frame_").get('Contents',[]);row['checkpoint_frames']=len(objects)
 summary.append(row)
(out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
