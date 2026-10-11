"""Download only the new demo dialogue, verify hashes and measure actual audio."""
import argparse,json,hashlib,subprocess
from pathlib import Path
import boto3
p=argparse.ArgumentParser();p.add_argument('--config',required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1]
c=json.loads(Path(a.config).read_text());s=boto3.client('s3',endpoint_url=c['S3_ENDPOINT'],region_name='auto',aws_access_key_id=c['S3_ACCESS_KEY_ID'],aws_secret_access_key=c['S3_SECRET_ACCESS_KEY']);out=root/'data/titokvaros/dialogue';out.mkdir(exist_ok=True,parents=True)
demo=json.loads((root/'production/titokvaros/episodes/TV_S1E1/demo.json').read_text());result=[]
for line in demo['dialogue']:
 prefix='native/S1E1/TITOKVAROS/V001/dialogue/'+line['id'];metadata=s.get_object(Bucket=c['S3_BUCKET'],Key=prefix+'.json')['Body'].read();d=json.loads(metadata)
 if d.get('status')!='RECORDED_PENDING_REVIEW':raise ValueError(line['id']+' not yet recorded')
 if d['key']!=prefix+'.mp3':raise ValueError('Unexpected dialogue key')
 data=s.get_object(Bucket=c['S3_BUCKET'],Key=d['key'])['Body'].read()
 if hashlib.sha256(data).hexdigest()!=d['sha256']:raise ValueError('Dialogue checksum mismatch')
 mp3=out/(line['id']+'.mp3');mp3.write_bytes(data);(out/(line['id']+'.json')).write_bytes(metadata)
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(mp3)]))
 result.append({'id':line['id'],'character':line['character'],'at':line['at'],'audio_duration_sec':duration,'end':line['at']+duration,'sha256':d['sha256'],'aligned_characters':len(d['alignment']['characters']),'temporary_voice':True,'listening_review':'PENDING'})
(out/'measured.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
