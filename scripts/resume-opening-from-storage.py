"""Resume an existing native review from R2 artifacts without any provider API.

Never submits, cancels, polls or infers a RunPod job status. The source manifest
is read-only. A separate artifact checkpoint survives local runtime failures.
"""
import argparse, datetime, hashlib, json, os, pathlib, shutil, subprocess, sys, time
import boto3
from botocore.exceptions import ClientError
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'worker'))
from native_checkpoints import render_identity
from native_assembly import assemble_native
from review_lease import ReviewLease

def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def inspect(path, frames):
    subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','null','-'],
                   check=True,capture_output=True,timeout=300)
    streams=json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames',
        '-show_entries','stream=codec_type,width,height,r_frame_rate,nb_read_frames,duration,sample_rate,channels',
        '-of','json',str(path)]))['streams']
    v=next(s for s in streams if s['codec_type']=='video')
    if (int(v['nb_read_frames']),v['r_frame_rate'],v['width'],v['height'])!=(frames,'24/1',1920,1080):
        raise ValueError('Artifact frame count/fps/dimensions differ from frozen job')
    return streams

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--credentials',help='Optional private JSON file; otherwise S3_* environment')
    p.add_argument('--watch-seconds',type=int,default=0)
    a=p.parse_args()
    if not 0<=a.watch_seconds<=7200:raise ValueError('Watch must be bounded to 0..7200 seconds')
    env=json.loads(pathlib.Path(a.credentials).read_text()) if a.credentials else os.environ
    s3=boto3.client('s3',endpoint_url=env['S3_ENDPOINT'],region_name='auto',
        aws_access_key_id=env['S3_ACCESS_KEY_ID'],aws_secret_access_key=env['S3_SECRET_ACCESS_KEY'])
    bucket=env['S3_BUCKET'];cache=ROOT/'data/V024/storage_review';cache.mkdir(parents=True,exist_ok=True)
    checkpoint=ROOT/'ops/v024-opening-storage-review.json'
    checkpoint_key='native/S1E1/V024/checkpoints/opening_storage_review_cloud.json'
    lease=ReviewLease(s3,bucket,'native/S1E1/V024/checkpoints/opening_storage_review_lease.json').acquire()
    raw=s3.get_object(Bucket=bucket,Key='native/S1E1/V024/checkpoints/opening_render_jobs.json')['Body'].read()
    manifest=json.loads(raw);jobs=manifest['jobs']
    expected=[('S1E1_SC001_V024',1392,'7ad6efdef7e624202cfb0f67772f5386a69b71ecf30f93ca86fafd63fccd4d79'),
              ('S1E1_SC003_V024',1776,'bb383b0350bd9f20219196b270d40b15e8e867d7d43817f229da8f6c18025d4b')]
    cursor=0
    for scene,total,digest in expected:
        start=1
        while cursor<len(jobs) and jobs[cursor]['scene_id']==scene:
            spec=jobs[cursor]['input']
            if spec['frame_start']!=start or spec['scene_sha256']!=digest:raise ValueError('Gap, overlap or source change')
            if not 1<=spec['frame_end']-start+1<=360:raise ValueError('Invalid bounded frame range')
            if (spec['width'],spec['height'],spec['samples'],spec['renderer_revision'])!=(1920,1080,48,'e3cb4348e93116c5cf56c3c9c9fa8b6a3cd2e8da'):
                raise ValueError('Frozen render contract changed')
            start=spec['frame_end']+1;cursor+=1
        if start!=total+1:raise ValueError('Incomplete planned scene coverage')
    if cursor!=9 or len(jobs)!=9:raise ValueError('Expected exactly nine existing jobs')
    # A restarted watcher must not assemble an already-verified movie again.
    try:
        prior=json.loads(s3.get_object(Bucket=bucket,Key=checkpoint_key)['Body'].read())
    except ClientError as exc:
        if exc.response['Error']['Code'] not in ('NoSuchKey','404'):raise
        prior={}
    if prior.get('status')=='ASSEMBLED_AND_DECODED':
        clip=prior['result']['clip'];final=ROOT/'data/V024/WonderlyTales_V024_opening_132s.mp4'
        if prior['result'].get('audio_sha256')!='c5ef49ad4a17959dc6c35d40a1c522d83fe13f112e667027d810bc73b00c9a4d':
            raise ValueError('Completed movie does not use the frozen Hungarian mix')
        if not final.exists() or sha(final)!=clip['sha256']:
            s3.download_file(bucket,clip['key'],str(final))
        if sha(final)!=clip['sha256']:raise ValueError('Completed movie checksum differs')
        streams=inspect(final,3168);track=next(s for s in streams if s['codec_type']=='audio')
        if abs(float(track['duration'])-132)>.05:raise ValueError('Completed movie audio duration differs')
        checkpoint.write_text(json.dumps(prior,indent=2)+'\n')
        print(json.dumps({'status':'ASSEMBLED_AND_DECODED','reused':True,'clip':clip}),flush=True)
        lease.release();return
    doc={'kind':'R2_ARTIFACT_REVIEW','production_approved':False,'provider_api_access':'BLOCKED_PROXY_403',
         'source_manifest_sha256':hashlib.sha256(raw).hexdigest(),'checkpoint_key':checkpoint_key,
         'assembly_reservation_id':'416e3140-cb2b-4f17-a02e-c4bb8effca83','jobs':[]}
    for job in jobs:
        spec=job['input'];prefix=f"renders/native/S1E1/{spec['scene_sha256']}/{render_identity(spec)}"
        doc['jobs'].append({'id':job['id'],'scene_id':job['scene_id'],'last_observed_provider_status':job['status'],
            'provider_status_observed_at':job.get('provider_date'),'input':spec,'key':prefix+'/clip.mp4',
            'artifact_status':'NOT_OBSERVED'})
    def save():
        doc['observed_at_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        data=(json.dumps(doc,indent=2)+'\n').encode();tmp=checkpoint.with_suffix('.tmp')
        tmp.write_bytes(data);tmp.replace(checkpoint)
        s3.put_object(Bucket=bucket,Key=checkpoint_key,Body=data,ContentType='application/json')
    deadline=time.monotonic()+a.watch_seconds
    while True:
        lease.renew()
        for original,job in zip(jobs,doc['jobs']):
            spec=job['input'];frames=spec['frame_end']-spec['frame_start']+1
            local=cache/(job['id']+'.mp4')
            if job['artifact_status']=='DECODED' and local.exists() and sha(local)==job['sha256']:continue
            try:
                response=s3.get_object(Bucket=bucket,Key=job['key'])
            except ClientError as exc:
                if exc.response.get('Error',{}).get('Code') not in ('NoSuchKey','404','NotFound'):raise
                prefix=job['key'].rsplit('/',1)[0]+'/'
                job['persisted_frame_objects']=sum(1 for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket,Prefix=prefix)
                    for obj in page.get('Contents',[]) if obj['Key'].endswith('.png'))
                continue
            data=response['Body'].read()
            if len(data)!=response['ContentLength']:raise ValueError('Truncated storage artifact')
            digest=hashlib.sha256(data).hexdigest()
            known=original.get('clip',{}).get('sha256')
            if known and known!=digest:raise ValueError('Provider and storage checksums differ')
            if response.get('Metadata',{}).get('sha256') not in (None,digest):raise ValueError('Object metadata checksum mismatch')
            local.write_bytes(data);streams=inspect(local,frames)
            job.update(artifact_status='DECODED',sha256=digest,bytes=len(data),verified_frames=frames,streams=streams)
            print(json.dumps({'clip':job['id'],'decoded_frames':frames,'sha256':digest}),flush=True)
        doc['decoded_frames']=sum(j.get('verified_frames',0) for j in doc['jobs'])
        doc['status']='ALL_CLIPS_DECODED' if doc['decoded_frames']==3168 else 'WAITING_FOR_R2_CLIPS';save()
        print(json.dumps({'decoded_frames':doc['decoded_frames'],'pending_frame_objects':[j.get('persisted_frame_objects',0) for j in doc['jobs'] if j['artifact_status']!='DECODED']}),flush=True)
        if doc['status']=='ALL_CLIPS_DECODED':
            lease.renew()
            payload={'operation':'ASSEMBLE_NATIVE_FILM','frames':3168,
                'clips':[{'key':j['key'],'sha256':j['sha256'],'frames':j['verified_frames']} for j in doc['jobs']],
                'audio_key':'audio/S1E1/review/V024/WonderlyTales_V024_opening_132s.wav',
                'audio_sha256':'c5ef49ad4a17959dc6c35d40a1c522d83fe13f112e667027d810bc73b00c9a4d'}
            audio=cache/'opening_132s.wav';s3.download_file(bucket,payload['audio_key'],str(audio))
            if sha(audio)!=payload['audio_sha256']:raise ValueError('Original Hungarian mix changed')
            cached={j['key']:cache/(j['id']+'.mp4') for j in doc['jobs']};cached[payload['audio_key']]=audio
            final=ROOT/'data/V024/WonderlyTales_V024_opening_132s.mp4'
            class CachedClient:
                def download_file(self,b,k,d):shutil.copyfile(cached[k],d)
                def upload_file(self,path,b,k,ExtraArgs=None):
                    shutil.copyfile(path,final);s3.upload_file(path,b,k,ExtraArgs=ExtraArgs)
            result=assemble_native(CachedClient(),bucket,payload)
            streams=inspect(final,3168);track=next(s for s in streams if s['codec_type']=='audio')
            if abs(float(track['duration'])-132)>.05:raise ValueError('Final audio duration mismatch')
            obj=s3.get_object(Bucket=bucket,Key=result['clip']['key'])
            if hashlib.sha256(obj['Body'].read()).hexdigest()!=result['clip']['sha256']:raise ValueError('Final readback mismatch')
            doc.update(status='ASSEMBLED_AND_DECODED',result=result,streams=streams,
                assembly_executor='CPU_USING_UNCHANGED_PRODUCTION_ASSEMBLY_CODE',
                provider_assembly_job_submitted=False)
            save();print(json.dumps({'status':doc['status'],'result':result}),flush=True);break
        if time.monotonic()>=deadline:break
        time.sleep(min(30,max(0,deadline-time.monotonic())))
    lease.release()
if __name__=='__main__':main()
