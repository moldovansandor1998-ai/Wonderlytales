"""Submit/poll a bounded review manifest using the existing renderer.

Budget reservations must already exist. A submission with an uncertain response
is never retried automatically. The production Supabase queue is unchanged.
"""
import argparse,json,pathlib,urllib.request,datetime,hashlib
import boto3

p=argparse.ArgumentParser();p.add_argument('operation',choices=['submit','poll']);p.add_argument('--manifest',required=True);p.add_argument('--credentials',required=True);a=p.parse_args()
path=pathlib.Path(a.manifest);doc=json.loads(path.read_text());credentials=json.loads(pathlib.Path(a.credentials).read_text())
client=boto3.client('s3',endpoint_url=credentials['S3_ENDPOINT'],aws_access_key_id=credentials['S3_ACCESS_KEY_ID'],aws_secret_access_key=credentials['S3_SECRET_ACCESS_KEY'],region_name='auto')
bucket=credentials['S3_BUCKET'];base='https://api.runpod.ai/v2/'+doc['endpoint'];headers={'Authorization':'Bearer '+credentials['RUNPOD_API_KEY'],'Content-Type':'application/json'}
def save():
    data=(json.dumps(doc,indent=2,ensure_ascii=False)+'\n').encode();temporary=path.with_suffix('.tmp');temporary.write_bytes(data);temporary.replace(path)
    client.put_object(Bucket=bucket,Key=doc['checkpoint_key'],Body=data,ContentType='application/json')
def request(suffix,payload=None):
    request=urllib.request.Request(base+suffix,data=json.dumps(payload).encode() if payload is not None else None,headers=headers)
    with urllib.request.urlopen(request,timeout=45) as response:return json.load(response),response.headers.get('Date')
if doc.get('production_approved') is not False or doc.get('kind') not in ('CONNECTED_OPENING_REVIEW','NATIVE_DIAGNOSTIC_REVIEW'):raise ValueError('Only the bounded review manifest is accepted')
if sum(j['input']['frame_end']-j['input']['frame_start']+1 for j in doc['jobs'])>3168:raise ValueError('Review exceeds 132 seconds')
for job in doc['jobs']:
    if a.operation=='submit':
        if job['status']!='PLANNED':continue
        if not job.get('budget_reservation_id') or job.get('reservation_usd')!=2.5:raise ValueError('Existing reservation required')
        spec=job['input'];count=spec['frame_end']-spec['frame_start']+1
        if not 1<=count<=360 or spec['operation']!='RENDER_NATIVE_FRAMES':raise ValueError('Invalid bounded native range')
        head=client.head_object(Bucket=bucket,Key=spec['scene_key'])
        if not 0<head['ContentLength']<1_000_000_000:raise ValueError('Native source size invalid')
        job['status']='SUBMITTING';save()
        try:
            result,date=request('/run',{'input':spec,'policy':{'executionTimeout':1800000}})
            if not result.get('id'):raise ValueError('Provider omitted job id')
            job.update(id=result['id'],status=result['status'],provider_date=date);save()
        except Exception as exc:
            job.update(status='SUBMISSION_UNCERTAIN',error=type(exc).__name__);save();raise
    else:
        if not job.get('id') or job['status'] in ('COMPLETED','FAILED','CANCELLED','TIMED_OUT'):continue
        result,date=request('/status/'+job['id']);job.update(status=result['status'],provider_date=date)
        for key in ('workerId','delayTime','executionTime','error'):
            if key in result:job[key]=result[key]
        if result['status']=='COMPLETED':
            output=result.get('output',{});clip=output.get('clip',{});expected=job['input']['frame_end']-job['input']['frame_start']+1
            if clip.get('verified_frames')!=expected or clip.get('verified_fps')!=24 or clip.get('verified_width')!=1920 or clip.get('verified_height')!=1080:raise ValueError('Completed clip verification differs from plan')
            job['clip']=clip;job['devices']=output.get('devices');seconds=output.get('frame_seconds',[])
            job['mean_frame_seconds']=sum(seconds)/len(seconds) if seconds else None
            version=doc.get('version','V024')
            if version not in ('V024','V025'):raise ValueError('Unsupported review version')
            key='native/S1E1/'+version+'/job-results/'+job['id']+'.json';client.put_object(Bucket=bucket,Key=key,Body=json.dumps(result).encode(),ContentType='application/json');job['result_key']=key
        save()
    print(job.get('id',job['scene_id']),job['status'],flush=True)
print('VERIFIED_FRAMES',sum(j.get('clip',{}).get('verified_frames',0) for j in doc['jobs']),flush=True)
