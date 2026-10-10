"""Build tracks for audited current recordings; no provider calls or guessed timing."""
import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'production'))
from animation_system.lipsync import build_recording
root,audit,output=map(Path,sys.argv[1:]);output.mkdir(parents=True,exist_ok=True)
report=json.loads(audit.read_text());tracks=[]
for row in report['rows']:
 if not row['alignment'] or not row['alignment']['usable_for_lipsync']:continue
 source=root/(row['id']+'.mp3');review=json.loads((root/(row['id']+'.review.json')).read_text())
 if hashlib.sha256(source.read_bytes()).hexdigest()!=row['audio_sha256']:raise ValueError('Audit source changed')
 if review['expected_text']!=row['text']:raise ValueError('Audit script changed')
 dest=output/(row['id']+'.visemes.json');track=build_recording(source,dest,review,row['text'])
 tracks.append({'dialogue_id':row['id'],'scene_id':row['scene_id'],'scene_number':row['scene'],'sequence':row['sequence'],'character':row['character'],'audio_path':row['path'],'audio_sha256':row['audio_sha256'],'visemes':dest.name,'visemes_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'duration':track['duration'],'cue_count':len(track['mouthCues'])})
manifest={'schema':'WONDERLY_VERIFIED_RECORDINGS_V1','tracks':tracks,'total_recordings':report['total'],'review_required':report['total']-len(tracks),'phonetics_approved':False,'production_approved':False}
(output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('Saved measured tracks:',len(tracks),'review required:',manifest['review_required'])
