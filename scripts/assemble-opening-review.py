"""Prepare/submit/poll the bounded native 132-second review assembly.

The production queue is unchanged. Existing voice files and GPU clips are
immutable. A previously uncertain provider submission is never repeated.
"""
import argparse, datetime, hashlib, json, pathlib, subprocess, urllib.request, wave
import boto3

p=argparse.ArgumentParser()
p.add_argument('operation',choices=['prepare','submit','poll','download'])
p.add_argument('--credentials',required=True)
p.add_argument('--budget-reservation-id')
a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
path=root/'ops/v024-opening-assembly.json'
creds=json.loads(pathlib.Path(a.credentials).read_text())
s3=boto3.client('s3',endpoint_url=creds['S3_ENDPOINT'],region_name='auto',
               aws_access_key_id=creds['S3_ACCESS_KEY_ID'],aws_secret_access_key=creds['S3_SECRET_ACCESS_KEY'])
bucket=creds['S3_BUCKET'];manifest=json.loads((root/'ops/v024-opening-render-jobs.json').read_text())
base='https://api.runpod.ai/v2/'+manifest['endpoint']
def digest(file):
    with file.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def save(doc):
    data=(json.dumps(doc,indent=2,ensure_ascii=False)+'\n').encode()
    temp=path.with_suffix('.tmp');temp.write_bytes(data);temp.replace(path)
    s3.put_object(Bucket=bucket,Key=doc['checkpoint_key'],Body=data,ContentType='application/json')
def request(suffix,payload=None):
    req=urllib.request.Request(base+suffix,data=json.dumps(payload).encode() if payload else None,
        headers={'Authorization':'Bearer '+creds['RUNPOD_API_KEY'],'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=45) as response:return json.load(response)
if a.operation=='prepare':
    if path.exists():raise ValueError('Existing assembly checkpoint must be resumed')
    out=root/'data/V024/WonderlyTales_V024_opening_132s.wav'
    sources=[('SC001',58,'b2a031e61f5eb07ce5d243fcb66f82151077318d758928fa33c865def34302ca'),
             ('SC003',74,'de2d4590e261a7028feb836975e5b8ed46eed5d9820f6260fbd940b56e1c09c9')]
    with wave.open(str(out),'wb') as dst:
        dst.setnchannels(2);dst.setsampwidth(2);dst.setframerate(48000)
        for scene,duration,sha in sources:
            file=root/f'data/V024/opening_revised/S1E1_{scene}_V024.wav'
            if digest(file)!=sha:raise ValueError('Frozen scene mix differs')
            with wave.open(str(file)) as src:
                if (src.getnchannels(),src.getsampwidth(),src.getframerate(),src.getnframes())!=(2,2,48000,duration*48000):raise ValueError('Scene audio format/duration mismatch')
                dst.writeframes(src.readframes(src.getnframes()))
    key='audio/S1E1/review/V024/WonderlyTales_V024_opening_132s.wav'
    s3.upload_file(str(out),bucket,key,ExtraArgs={'ContentType':'audio/wav'})
    doc={'kind':'CONNECTED_OPENING_REVIEW','production_approved':False,'status':'WAITING_FOR_CLIPS',
         'checkpoint_key':'native/S1E1/V024/checkpoints/opening_assembly.json',
         'audio_key':key,'audio_sha256':digest(out),'frames':3168,'duration_sec':132,
         'source_scenes':[dict(scene=scene,duration_sec=seconds,sha256=sha) for scene,seconds,sha in sources],
         'mix_note':'19 unchanged Hungarian takes, original scratch score and environment cues; three unresolved takes flagged'}
    save(doc)
else:
    doc=json.loads(path.read_text())
    if a.operation=='submit':
        if doc['status']!='WAITING_FOR_CLIPS':raise ValueError('Submission already attempted; inspect existing job')
        if not a.budget_reservation_id:raise ValueError('Pre-existing budget reservation required')
        jobs=manifest['jobs'];expected=[('S1E1_SC001_V024',1392),('S1E1_SC003_V024',1776)]
        if len(jobs)!=9 or any(j['status']!='COMPLETED' for j in jobs):raise ValueError('All nine clips must complete before assembly')
        cursor=0;clips=[]
        for scene,total in expected:
            start=1;frozen=None
            while cursor<len(jobs) and jobs[cursor]['scene_id']==scene:
                job=jobs[cursor];spec=job['input'];clip=job['clip'];count=spec['frame_end']-spec['frame_start']+1
                if spec['frame_start']!=start or clip['verified_frames']!=count:raise ValueError('Gap, overlap or wrong clip length')
                if frozen and frozen!=spec['scene_sha256']:raise ValueError('Mixed source versions within a scene')
                frozen=spec['scene_sha256'];start=spec['frame_end']+1
                clips.append(dict(key=clip['key'],sha256=clip['sha256'],frames=count));cursor+=1
            if start!=total+1:raise ValueError('Incomplete scene')
        if cursor!=9 or sum(c['frames'] for c in clips)!=3168:raise ValueError('Review coverage mismatch')
        payload={'operation':'ASSEMBLE_NATIVE_FILM','clips':clips,'frames':3168,
                 'audio_key':doc['audio_key'],'audio_sha256':doc['audio_sha256']}
        doc.update(status='SUBMITTING',budget_reservation_id=a.budget_reservation_id,reservation_usd=2.5,input=payload)
        save(doc)
        try:
            result=request('/run',{'input':payload,'policy':{'executionTimeout':1800000}})
            if not result.get('id'):raise ValueError('Provider omitted job ID')
            doc.update(id=result['id'],status=result['status']);save(doc)
        except Exception as exc:
            doc.update(status='SUBMISSION_UNCERTAIN',error=type(exc).__name__);save(doc);raise
    elif a.operation=='poll':
        if not doc.get('id'):raise ValueError('Assembly has not been submitted')
        if doc['status'] not in ('COMPLETED','FAILED','CANCELLED','TIMED_OUT'):
            result=request('/status/'+doc['id']);doc.update(status=result['status'],result=result);save(doc)
    else:
        if doc['status']!='COMPLETED':raise ValueError('Assembly is not complete')
        clip=doc['result']['output']['clip'];out=root/'data/V024/WonderlyTales_V024_opening_132s.mp4'
        if not out.exists() or digest(out)!=clip['sha256']:
            response=s3.get_object(Bucket=bucket,Key=clip['key']);data=response['Body'].read()
            if len(data)!=response['ContentLength'] or hashlib.sha256(data).hexdigest()!=clip['sha256']:raise ValueError('Incomplete or mismatched download')
            out.write_bytes(data)
        subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(out),'-f','null','-'],check=True,capture_output=True)
        info=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries',
            'stream=codec_type,width,height,r_frame_rate,nb_read_frames,duration,sample_rate,channels','-of','json',str(out)]))
        video=next(s for s in info['streams'] if s['codec_type']=='video')
        audio=next(s for s in info['streams'] if s['codec_type']=='audio')
        if (int(video['nb_read_frames']),video['r_frame_rate'],video['width'],video['height'])!=(3168,'24/1',1920,1080):raise ValueError('Downloaded movie differs from bounded review')
        if abs(float(audio['duration'])-132)>.05:raise ValueError('Assembled audio duration mismatch')
        doc['local_verification']={'sha256':digest(out),'decoded':True,'streams':info['streams'],
                                   'verified_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        save(doc)
print(json.dumps({k:doc[k] for k in ('status','id','audio_sha256','local_verification') if k in doc},indent=2))
