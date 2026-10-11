"""Scoped, resumable WonderlyTales title production helper. No embedded secrets.

Read-only provider polling and immutable asset uploads. Paid submit requires an
explicit saved budget receipt and a permanent R2 claim; ambiguous submits never retry.
The WaveSpeed key is read only from stdin, never logged or written to disk.
"""
import argparse, hashlib, json, mimetypes, sys, urllib.request
from pathlib import Path
import boto3
from botocore.exceptions import ClientError

ROOT=Path('/workspace/scratch/77d35433dfb7/felix-ai')
PREFIX='ai-video/wavespeed/v1/76197ae3-b002-44b2-8e50-e884ee1b34bd/'
API='https://api.wavespeed.ai/api/v3/'
CONFIG=Path('/workspace/scratch/ff478e8da6f9/private/runtime.json')

def storage():
    c=json.loads(CONFIG.read_text())
    return boto3.client('s3',endpoint_url=c['S3_ENDPOINT'],region_name='auto',aws_access_key_id=c['S3_ACCESS_KEY_ID'],aws_secret_access_key=c['S3_SECRET_ACCESS_KEY']),c['S3_BUCKET']

def api(key,path,body=None):
    req=urllib.request.Request(API+path,data=None if body is None else json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=90) as r: result=json.load(r)
    if result.get('code')!=200:raise RuntimeError('Provider business error')
    return result['data']

def upload(path):
    s,bucket=storage();data=path.read_bytes();sha=hashlib.sha256(data).hexdigest()
    name=PREFIX+'title/inputs/'+sha+path.suffix
    try:s.put_object(Bucket=bucket,Key=name,Body=data,ContentType=mimetypes.guess_type(path.name)[0] or 'application/octet-stream',IfNoneMatch='*',Metadata={'sha256':sha})
    except ClientError as e:
        if e.response['ResponseMetadata']['HTTPStatusCode'] not in (409,412):raise
    return s.generate_presigned_url('get_object',Params={'Bucket':bucket,'Key':name},ExpiresIn=86400)

def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['poll','prepare','prepare-transcript','quote','submit']);p.add_argument('--id');p.add_argument('--name',default='title-dialogue');p.add_argument('--image');p.add_argument('--audio');p.add_argument('--video');p.add_argument('--model',default='wavespeed-ai/longcat-avatar-1.5');p.add_argument('--prompt');p.add_argument('--budget-receipt');p.add_argument('--output-kind',choices=['video','text'],default='video');a=p.parse_args()
    if a.action=='prepare-transcript':
        payload={'video':upload(Path(a.video)),'language':'hu','task':'transcribe','enable_timestamps':True}
        (ROOT/(a.name+'-payload.json')).write_text(json.dumps(payload));print(json.dumps({'prepared':a.name}));return
    if a.action=='prepare':
        payload={'image':upload(Path(a.image)),'audio':upload(Path(a.audio)),'resolution':'720p','seed':731,'prompt':a.prompt}
        if a.video:payload.pop('image');payload['video']=upload(Path(a.video))
        (ROOT/(a.name+'-payload.json')).write_text(json.dumps(payload));print(json.dumps({'prepared':a.name}));return
    key=sys.stdin.readline().strip()
    if not key:raise RuntimeError('Missing provider key')
    if a.action=='poll':
        result=api(key,'predictions/'+a.id+'/result');assert result['id']==a.id
        (ROOT/(a.name+'-result.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2))
        if result['status']=='completed':
            url=result['outputs'][0]
            if a.output_kind=='text':
                if isinstance(url,str) and url.startswith('https://'):
                    with urllib.request.urlopen(url,timeout=90) as r: transcribed=r.read(2*1024*1024).decode()
                else:transcribed=url if isinstance(url,str) else json.dumps(url)
                (ROOT/(a.name+'-transcription.txt')).write_text(transcribed)
                print(json.dumps({'status':'completed','transcription':transcribed[:5000]},ensure_ascii=False));return
            assert url.startswith('https://')
            with urllib.request.urlopen(url,timeout=90) as r:data=r.read(150*1024*1024)
            if data[4:8]!=b'ftyp':raise RuntimeError('Not an MP4')
            dest=ROOT/(a.name+'.mp4');dest.write_bytes(data)
            print(json.dumps({'status':result['status'],'path':str(dest),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}))
        else:print(json.dumps({'id':result['id'],'status':result['status'],'error':(result.get('error') or '')[:240]}))
        return
    payload=json.loads((ROOT/(a.name+'-payload.json')).read_text())
    price=api(key,'model/price',{'model_id':a.model,'inputs':payload});balance=api(key,'balance')['balance']
    quote={'model':a.model,'price':price['discounted_price'],'currency':price['currency'],'balance':balance,'payloadSha256':hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()}
    if a.action=='quote':(ROOT/(a.name+'-quote.json')).write_text(json.dumps(quote));print(json.dumps(quote));return
    receipt=json.loads(Path(a.budget_receipt).read_text())
    assert receipt['project_id']=='vruxiyvlynbivzjuijed' and receipt['purpose']==a.name and receipt['model']==a.model and receipt['payloadSha256']==quote['payloadSha256']
    assert 0<=quote['price']<=receipt['amount_usd']<=1 and quote['price']<=balance
    s,bucket=storage();claim=PREFIX+'title/jobs/'+receipt['reservation_id']+'.json'
    record={'status':'SUBMITTING','budget':receipt,'quote':quote}
    try:s.put_object(Bucket=bucket,Key=claim,Body=json.dumps(record),ContentType='application/json',IfNoneMatch='*')
    except ClientError as e:
        if e.response['ResponseMetadata']['HTTPStatusCode'] in (409,412):
            old=json.loads(s.get_object(Bucket=bucket,Key=claim)['Body'].read());print(json.dumps({'status':old['status'],'taskId':old.get('taskId'),'duplicatePrevented':True}));return
        raise
    try:
        result=api(key,a.model,payload);record.update(status=result['status'],taskId=result['id'])
        (ROOT/(a.name+'-submission.json')).write_text(json.dumps(record,indent=2))
        s.put_object(Bucket=bucket,Key=claim,Body=json.dumps(record),ContentType='application/json')
        print(json.dumps({'status':result['status'],'taskId':result['id'],'quotedUsd':quote['price']}))
    except Exception:
        print(json.dumps({'status':'UNCERTAIN','message':'Never automatically resubmit this reservation'}));raise

if __name__=='__main__':main()
