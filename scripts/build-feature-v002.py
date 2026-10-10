"""Compose a reviewable feature draft from the current, accepted story basis.
No TTS, database changes, render jobs, invented recordings or duration approval.
"""
from pathlib import Path
import json,copy,hashlib,uuid,math
REPO=Path(__file__).resolve().parents[1];ROOT=REPO/'production/episodes/S1E1';OUT=ROOT/'feature_V002'
source=ROOT/'timing/current_recordings_V002/episode_script_current_recordings_DRAFT.json'
base=json.loads(source.read_text());manifest=json.loads((REPO/'ops/speech-v023-manifest.json').read_text());audit=json.loads((REPO/'ops/current-speech-audit-20261010.json').read_text());acceptance=json.loads((ROOT/'approvals/V016_basis_user_acceptance_20261010.json').read_text())
rows={r['id']:r for r in audit['rows']};tracks={r['dialogue_id']:r for r in manifest['tracks']};extension=OUT/'new_scenes_HU.txt';new=[]
for line in extension.read_text().splitlines():
 if line.startswith('@'):
  code,after,seconds,title,place=line[1:].split('|');scene={'scene_code':'S1E1_'+code,'insert_after':int(after),'planned_duration_sec':int(seconds),'title_hu':title,'location_notes':place,'origin':'FEATURE_V002_NEW','beats':[]};new.append(scene)
 elif line.startswith('A: '):scene['beats'].append({'kind':'ACTION','direction_hu':line[3:]})
 elif line.startswith('CHAR_'):
  speaker,text=line.split(': ',1)
  if speaker=='CHAR_BOGYO':raise ValueError('Bogyó cannot have human dialogue')
  scene['beats'].append({'kind':'DIALOGUE','character':speaker,'text_hu':text,'recording_status':'NOT_RECORDED'})
 elif line.startswith('K: '):scene['camera_direction_hu']=line[3:]
 elif line.startswith('S: '):scene['sound_direction_hu']=line[3:]
scenes=[{'scene_code':'S1E1_INTRO_V016','title_hu':'ELFOGADOTT FŐCÍM','planned_duration_sec':15,'origin':'ACCEPTED_V016','beats':[],'asset':next(a for a in acceptance['accepted_assets'] if a['kind']=='intro')}]
for original in base['scenes']:
 s=copy.deepcopy(original);number=int(s['scene_code'][-3:]);s['origin']='CURRENT_RECORDINGS_V002_PRESERVED'
 if number==16:
  split=next(i for i,b in enumerate(s['beats']) if b.get('direction_hu','').startswith('Morzsi felveszi a kosarat.'))
  tail=copy.deepcopy(s);tail.update(scene_code=s['scene_code']+'_RETURN',title_hu='INDULÁS A KAPUHOZ',planned_duration_sec=20,beats=s['beats'][split:]);s.update(planned_duration_sec=45,beats=s['beats'][:split])
  scenes.extend([s,copy.deepcopy(next(n for n in new if n['scene_code']=='S1E1_E20')),tail])
 else:
  scenes.append(s);scenes.extend(copy.deepcopy(n) for n in new if n['insert_after']==number)
clock=0;dialogue=[];used=set();issues=[]
names={'CHAR_MARK':'MÁRK','CHAR_LILI':'LILI','CHAR_MORZSI':'MORZSI','CHAR_POTTY':'PÖTTY','CHAR_ZIZI':'ZIZI'}
for s in scenes:
 s['planned_start_sec']=clock;clock+=s['planned_duration_sec'];s['planned_end_sec']=clock;s['actual_duration_sec']=None;s['animatic_verified']=False;s['render_eligible']=False
 for i,b in enumerate(s['beats']):
  if b['kind']!='DIALOGUE':continue
  rid=b.get('recording_id');r=rows.get(rid)
  if r and r['character']==b['character'] and r['text']==b['text_hu'] and rid not in used:
   used.add(rid);b.update(audio_storage_key=r['path'],audio_sha256=r['audio_sha256'],duration_sec=r['duration'],recording_status='TIMING_READY_REVIEW_ACTING' if rid in tracks else 'REVIEW_REQUIRED')
   b['viseme_storage_key']='audio/S1E1/verified_v023/'+tracks[rid]['visemes'] if rid in tracks else None
  else:
   b.update(recording_id=None,audio_storage_key=None,audio_sha256=None,viseme_storage_key=None,recording_status='NOT_RECORDED')
   if s['origin']=='CURRENT_RECORDINGS_V002_PRESERVED':issues.append({'scene':s['scene_code'],'text':b['text_hu'],'reason':'no exact current recording match'})
  b['dialogue_id']=rid if b.get('recording_id') else str(uuid.uuid5(uuid.NAMESPACE_URL,'wonderlytales:FEATURE_V002:'+s['scene_code']+':'+str(i)+':'+b['text_hu']))
  dialogue.append({'scene_code':s['scene_code'],'scene_start_planned_sec':s['planned_start_sec'],'beat':i,**b})
assert clock==3600,clock
assert len({s['scene_code'] for s in scenes})==len(scenes)
assert len({b['dialogue_id'] for b in dialogue})==len(dialogue)
plan={'schema':'WONDERLY_FEATURE_DRAFT_V2','episode':'S1E1','title_hu':'A csillagszilánk','target_duration_sec':3600,'minimum_duration_sec':2400,'planned_duration_sec':clock,'actual_duration_sec':None,'status':'SCRIPT_AND_SCENE_DRAFT_NOT_RENDERABLE','production_approved':False,'animatic_verified':False,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'extension_sha256':hashlib.sha256(extension.read_bytes()).hexdigest(),'accepted_basis':acceptance['accepted_assets'],'scene_count':len(scenes),'new_scenes':len(new),'dialogue_count':len(dialogue),'spoken_words_hu':sum(len(b['text_hu'].split()) for b in dialogue),'recordings_reused':len(used),'new_or_unmatched_recordings':sum(b['recording_status']=='NOT_RECORDED' for b in dialogue),'recording_binding_issues':issues,'outside_story_recordings':[{'id':r['id'],'text':r['text'],'reason':'Existing separate end-card CTA, kept outside the story draft'} for r in audit['rows'] if r['id'] not in used],'scenes':scenes}
(OUT/'feature_scene_plan_V002.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n');(OUT/'dialogue_recording_sheet_V002.json').write_text(json.dumps({'production_approved':False,'rows':dialogue},ensure_ascii=False,indent=2)+'\n')
def tc(t):return f'{t//60:02}:{t%60:02}'
text=['WONDERLY TALES – CSODAKAPU: A CSILLAGSZILÁNK','FEATURE_V002 – TELJES SZERKESZTETT MAGYAR MUNKAVÁLTOZAT','', '60 perces rendezői időkeret; a tényleges játékidő még nincs lemérve.', 'A V016 főcím és az elfogadott hangvágás a megőrzött alap. Az új jelenetek hangja még nem készült el.','Nem kész film és nem renderengedély. A bővítés olvasópróbát, animaticot és folytonossági ellenőrzést igényel.','']
for s in scenes:
 text.extend([f"{s['scene_code']} — {s['title_hu']}",f"Tervezett: {tc(s['planned_start_sec'])}–{tc(s['planned_end_sec'])}. {s.get('location_notes','')}"])
 if s['origin']=='ACCEPTED_V016':text.append('A változatlan, elfogadott 15 másodperces főcímmaster; epizódszám: S1E1.')
 for b in s['beats']:text.append(b.get('direction_hu','') if b['kind']=='ACTION' else names[b['character']]+': '+b['text_hu'])
 for key,label in [('camera_direction_hu','Kamera'),('sound_direction_hu','Hang')]:
  if s.get(key):text.append(label+': '+s[key])
 text.append('')
(OUT/'S1E1_teljes_forgatokonyv_HU_FEATURE_V002.txt').write_text('\n'.join(line.rstrip() for line in text).rstrip()+'\n')
summary={k:v for k,v in plan.items() if k not in ('scenes','accepted_basis')};(OUT/'validation_V002.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
