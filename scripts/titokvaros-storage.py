"""Persist only explicitly named new Titokvaros artifacts, read back and hash.

Credentials are supplied by --config outside the repository. No existing
Csodakapu or previously blocked private payload is read or uploaded.
"""
import argparse
import hashlib
import json
import mimetypes
from pathlib import Path
import boto3

p=argparse.ArgumentParser();p.add_argument('--config',required=True);p.add_argument('files',nargs='+');a=p.parse_args()
c=json.loads(Path(a.config).read_text());root=Path(__file__).resolve().parents[1];data=root/'data/titokvaros'
s=boto3.client('s3',endpoint_url=c['S3_ENDPOINT'],aws_access_key_id=c['S3_ACCESS_KEY_ID'],aws_secret_access_key=c['S3_SECRET_ACCESS_KEY'],region_name='auto')
allowed={'Titokvaros_visual_direction_V001.png','TV_MASTER_V001.blend','TV_model_proof_V001.png','TV_motion_review_V001.mp4','asset_audit.json','Titokvaros_S1E1_forgatokonyv_V001.txt','TV_ANIMATED_V001.blend','motion_audit.json'}
evidence=[]
for name in a.files:
 if name not in allowed:raise ValueError('Not an approved Titokvaros artifact filename')
 path=data/name;raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest();key='native/S1E1/TITOKVAROS/V001/'+name
 try:
  h=s.head_object(Bucket=c['S3_BUCKET'],Key=key)
 except s.exceptions.ClientError as e:
  if e.response['ResponseMetadata']['HTTPStatusCode']!=404:raise
  h=None
 if h and h.get('Metadata',{}).get('sha256')!=sha:raise ValueError('Immutable version exists with different content: '+name)
 if not h:s.put_object(Bucket=c['S3_BUCKET'],Key=key,Body=raw,ContentType=mimetypes.guess_type(name)[0] or 'application/octet-stream',Metadata={'sha256':sha,'series':'TITOKVAROS'},IfNoneMatch='*')
 received=s.get_object(Bucket=c['S3_BUCKET'],Key=key)['Body'].read()
 if hashlib.sha256(received).hexdigest()!=sha:raise ValueError('Readback mismatch')
 evidence.append({'key':key,'sha256':sha,'bytes':len(raw),'readback_verified':True})
out=root/'ops/titokvaros-artifacts.json'
old=json.loads(out.read_text()) if out.exists() else []
merged={x['key']:x for x in old+evidence};out.write_text(json.dumps(list(merged.values()),indent=2)+'\n')
print(json.dumps(evidence,indent=2))
