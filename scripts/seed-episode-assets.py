"""Import existing approved WonderlyTales assets; never invokes a paid API.

Only writes this production owner's AI-video prefix. Existing episode edits are
preserved. Run with --config (server storage credentials) and --assets (scratch
asset root). No credentials are copied into the repo or output.
"""
import argparse, hashlib, json
from datetime import datetime, timezone
from pathlib import Path
import boto3
from botocore.exceptions import ClientError
from PIL import Image

PREFIX = 'ai-video/wavespeed/v1/76197ae3-b002-44b2-8e50-e884ee1b34bd/'
INTRO = 'a1709001-2026-4011-8010-000000000000'
STORY = ['af642e9e-f142-432e-bc56-2c9ed19f09a9', '7b0d342b-28fe-4292-b387-153d728a7cb8']
REF_FILES = {
    'felix': 'upload/01-13904.png',
    'mira': 'generated_images/exec-dc395a25-f351-403d-a90e-0224dc5619c4.png',
    'nera': 'generated_images/exec-3966caa5-ed7f-46f1-8d56-14ad83f1b573.png',
    'tilda': 'generated_images/exec-676ff4ae-7fe6-4b84-872e-fab10c966998.png',
    'oszkar': 'generated_images/exec-317f3169-586e-4871-b381-f7ae96423ea8.png',
}

def main():
    p=argparse.ArgumentParser(); p.add_argument('--config',required=True); p.add_argument('--assets',required=True); a=p.parse_args()
    cfg=json.loads(Path(a.config).read_text()); root=Path(a.assets)
    s=boto3.client('s3',endpoint_url=cfg['S3_ENDPOINT'],region_name='auto',aws_access_key_id=cfg['S3_ACCESS_KEY_ID'],aws_secret_access_key=cfg['S3_SECRET_ACCESS_KEY'])
    bucket=cfg['S3_BUCKET']; manifest=json.loads((root/'felix-ai/episode-seed.json').read_text())
    now=datetime.now(timezone.utc).isoformat()
    def read(key):
        try:
            r=s.get_object(Bucket=bucket,Key=PREFIX+key)
            return json.loads(r['Body'].read()),r['ETag']
        except ClientError as e:
            if e.response['ResponseMetadata']['HTTPStatusCode']==404:return None,None
            raise
    def write(key,data,mime='application/json',etag=None,meta=None):
        body=json.dumps(data,ensure_ascii=False).encode() if mime=='application/json' else data
        try:
            s.put_object(Bucket=bucket,Key=PREFIX+key,Body=body,ContentType=mime,Metadata=meta or {},**({'IfMatch':etag} if etag else {'IfNoneMatch':'*'}))
            return True
        except ClientError as e:
            if e.response['ResponseMetadata']['HTTPStatusCode'] in (409,412):return False
            raise
    def image(file):
        path=root/file; data=path.read_bytes(); sha=hashlib.sha256(data).hexdigest()
        with Image.open(path) as im:w,h=im.size
        write('images/'+sha,data,'image/png',meta={'sha256':sha,'width':str(w),'height':str(h)})
        return sha
    refs={}
    for key,file in REF_FILES.items():
        sha=image(file); refs[key]=sha; cast=manifest['cast'][key]
        old,etag=read('reference/'+cast['id']+'.json')
        if old and old['sha256']!=sha:raise RuntimeError('Different saved reference; review before replacing '+key)
        if not old:write('reference/'+cast['id']+'.json',{'characterId':cast['id'],'name':cast['name'],'sha256':sha,'updatedAt':now})
    image_shas=[image('felix-ai/Titokvaros_focim_tiszta_kezdokep_V003.png'),refs['felix'],image('felix-ai/scene01-last.png'),image('generated_images/exec-dbc5b949-686f-42ca-9336-282bd16f37e0.png')]
    ids=[INTRO]+STORY
    files=['WonderlyTales_Titokvaros_Focim_1080p.mp4','Felix_01_WaveSpeed.mp4','Felix_02_WaveSpeed.mp4']
    for i,(job_id,file) in enumerate(zip(ids,files)):
        data=(root/'felix-ai'/file).read_bytes(); sha=hashlib.sha256(data).hexdigest()
        if data[4:8]!=b'ftyp':raise RuntimeError('Not MP4')
        write('media/'+job_id+'.mp4',data,'video/mp4',meta={'sha256':sha})
        old,etag=read('jobs/'+job_id+'.json')
        if not old:
            if i:raise RuntimeError('Missing original job; refusing to fabricate provenance')
            old={'id':job_id,'imageSha256':image_shas[i],'prompt':'Approved edited title master with Felix character voice and separate title graphics.','duration':10,'sound':True,'maxCostUsd':0,'requestHash':sha,'model':'wonderlytales/edited-master','status':'COMPLETED','createdAt':now,'estimatedCostUsd':0,'mediaVerified':False,'productionApproved':False,'archived':True}
            write('jobs/'+job_id+'.json',old)
        elif not old.get('archived'):
            old['archived']=True; write('jobs/'+job_id+'.json',old,etag=etag)
    created=0
    for i,row in enumerate(manifest['scenes']):
        state=row['state']; state.update(revision=1,updatedAt=now)
        if i<4:state.update(imageSha256=image_shas[i],imageApproved=i<3)
        if i<3:state.update(videoJobId=ids[i],review='keep')
        if i==2:state['note']+=' A klip végi túl közeli képet a végső vágásban rövidítjük, a használható futást megtartjuk.'
        created+=write('episode-scene/'+state['id']+'.json',state)
    print(json.dumps({'references':len(refs),'archivedExistingVideos':len(ids),'seededScenes':created,'scene3ImageNeedsApproval':True}))

if __name__=='__main__':main()
