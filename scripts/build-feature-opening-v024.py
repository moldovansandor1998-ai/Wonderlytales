"""Stage the first two FEATURE_V002 units as a connected 132-second native trial.

Preserves all 19 original takes. Three unresolved takes stay marked for review
and are staged off screen; this is not a speech approval or the final film.
"""
import json,hashlib,shutil,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'production'))
from animation_system.spec import validate_scene,compile_episode
feature_path=root/'production/episodes/S1E1/feature_V002/feature_scene_plan_V002.json'
feature=json.loads(feature_path.read_text());reg=json.loads((root/'data/V024/asset_registry_V024.json').read_text())
dest=root/'production/episodes/S1E1/feature_V002/quality_opening_V024';dest.mkdir(exist_ok=True)
runtime=root/'data/V024/opening';(runtime/'audio').mkdir(parents=True,exist_ok=True)
def action(clip,start,end,**kwargs):return dict(clip=clip,start=start,end=end,**kwargs)
def actor(code,position,actions,gaze):return dict(code=code,version=reg['characters'][code]['version'],position=position,yaw=0,actions=actions,gaze=gaze)
def look(start,end,target,position=None):
    r=dict(start=start,end=end,target=target)
    if position:r['position']=position
    return r
mark1=actor('CHAR_MARK',[-.65,1.1,0],[action('walk',0,7,destination=[-.65,-.5,0]),action('turn',8,10,look_at='CHAR_LILI'),action('surprise',16,18),action('interact',24,28),action('walk',36,41,destination=[-.4,-1,0]),action('turn',46,48,yaw=0),action('interact',48,51),action('surprise',54,57)],[look(8,15,'CHAR_LILI'),look(18,31,'prop',[-.3,-1.1,.08]),look(36,58,'prop',[-.1,-1.35,.23])])
lili1=actor('CHAR_LILI',[.55,1.3,0],[action('walk',0,7,destination=[.5,-.2,0]),action('turn',8,10,look_at='CHAR_MARK'),action('surprise',16,18),action('interact',28,33),action('walk',34,39,destination=[.6,-1.15,0]),action('turn',39,42,look_at='CHAR_MARK'),action('interact',43,46)],[look(8,15,'CHAR_MARK'),look(18,33,'prop',[-.3,-1.1,.08]),look(39,58,'CHAR_MARK')])
mark2=actor('CHAR_MARK',[-.4,-1,0],[action('interact',0,4),action('pickup',18,27,body_lower=.38),action('interact',27,31),action('turn',31,35,look_at='CHAR_LILI'),action('turn',40,43,yaw=0),action('interact',53,59),action('walk',68,74,destination=[-.4,-2.1,0])],[look(0,25,'prop',[-.1,-1.35,.23]),look(27,39,'CHAR_LILI'),look(53,67,'CHAR_LILI')])
lili2=actor('CHAR_LILI',[.6,-1.15,0],[action('turn',0,2,look_at='CHAR_MARK'),action('interact',2,7),action('walk',29,36,destination=[.5,-.3,0]),action('turn',36,38,look_at='CHAR_MARK'),action('interact',59,64),action('walk',68,74,destination=[.7,-1.8,0])],[look(0,8,'prop',[-.1,-1.35,.23]),look(10,29,'CHAR_MARK'),look(36,67,'CHAR_MARK')])
# Route direction changes get real planted turning steps before translation.
mark1['actions'].append(action('turn',34,36,yaw=.46365))
next(a for a in lili1['actions'] if a['clip']=='interact' and a['start']==28)['end']=32
lili1['actions'].append(action('turn',32,34,yaw=.10488))
lili2['yaw']=-1.71969
lili2['actions'].extend([action('turn',27,29,yaw=-3.02448),action('turn',66,68,yaw=.13255)])
for item in [mark1,lili1,mark2,lili2]:item['actions'].sort(key=lambda a:a['start'])
presets={
 'W':([3.0,-4.8,2.3],[0,-.2,.85],42),
 'M':([1.0,-2.8,1.7],[-.6,-.5,1.28],58),
 'L':([-.5,-2.3,1.08],[.52,-.4,.63],55),
 'F':([.7,-2.1,.4],[-.3,-1.1,.07],60),
 'S':([.7,-2.2,.7],[-.1,-1.35,.23],65),
 'T':([2.8,-2.5,1.65],[0,-.8,.85],45),
 'H':([.9,-2.2,1.05],[-.1,-1.2,.65],60),
 'E':([-2.5,-3.0,1.65],[0,-1.0,.8],42),
}
shots1=[(0,'W','Erdei követés; két eltérő lépésritmus, egymás bevárása.'),(7,'M','Márk ropogós levelet mutat, Lili felé fordul.'),(11,'L','Lili játékos válasza, szemkontaktus a fiúval.'),(15,'F','A kiszemelt levél megemelkedik, alatta türkiz fény fut.'),(17,'M','Márk meglepődik, kezét nyitva tartja.'),(19,'L','Lili a levelet, majd a fényt figyeli.'),(22,'T','Közös kép: Márk a fény irányát mutatja.'),(26,'F','A fény a gyökér mellé kerül; új megfigyelés, nem állókép.'),(29,'W','Három fényjelre forduló fejek; a madárhang elhallgat.'),(31,'L','Lili felismeri a jelzés ismétlődését.'),(35,'F','Kinek? képen kívül: a kamera a fényjel címzettjét keresi.'),(38,'E','Márk közelít a kőhöz; Lili mellé ér, nem haladnak egymáson át.'),(42,'L','Lili óvatosságra inti, a tekintet kézre, majd szemre vált.'),(46,'T','Márk megáll és visszahúzza a kezét.'),(49,'S','A csillagszilánk törött felső csúcsa és a levelek erezete.'),(51,'M','Márk halk felismerése.'),(54,'S','Fényimpulzus, üveges hang; átvezetés ugyanarra a tárgyra.')]
shots2=[(0,'E','Ugyanaz a tengely és kő; a barátok helyzete folytonos.'),(5,'S','A moha sértetlen; Lili vizsgálata képen kívüli hanggal, hibás take jelölve.'),(10,'M','Márk óvatos feltevése.'),(13.5,'L','Lili száraz humora, enyhe mosoly.'),(17,'T','Márk leereszkedik a kőhöz; a lábak támaszban maradnak.'),(21,'S','Kendő és kéz közelít a szilánkhoz.'),(24,'H','A bal kéz érintkezik, a tárgy felvétele után a kézzel együtt halad.'),(26,'M','Márk öröme a fény erősödésekor.'),(29,'W','Lili lassan megkerüli; Márk vele fordul.'),(34,'T','A fény gyengül: a változást közös kép igazolja.'),(38,'L','Lili visszafordulást kér.'),(40,'W','Márk irányt vált, a fény erősödik.'),(45,'H','A tárgy közelije a két megszólalás alatt; Lili take továbbra is javítandó.'),(51,'E','Egymás reakcióját figyelik, nem újabb üres fényvárás.'),(55,'H','Márk észreveszi a csillag hiányzó részét.'),(60,'L','Lili összekapcsolja a hiányt egy nagyobb tárggyal.'),(64,'M','A fiú a gyors indulás helyett előbb visszakérdez.'),(68,'W','Közös elindulás a jelzett úton, vágás a következő történetegység felé.')]
scenes=[];storyboard=[]
for source_code,duration,starts,cast,shots in [('S1E1_SC001',58,[7,11,17,19,22,31,35,42,51],[mark1,lili1],shots1),('S1E1_SC003',74,[5,10,13.5,26,38,45,48,56,60,66],[mark2,lili2],shots2)]:
    unit=next(s for s in feature['scenes'] if s['scene_code']==source_code)
    lines=[b for b in unit['beats'] if b['kind']=='DIALOGUE'];assert len(lines)==len(starts)
    scene=dict(schema='WONDERLY_SCENE_V1',id=source_code+'_V024',fps=24,duration=duration,location='LOC_FOREST_V021',studio=False,characters=cast,dialogue=[],offscreen_dialogue=[],cameras=[],interactions=[],source_feature_sha256=hashlib.sha256(feature_path.read_bytes()).hexdigest(),source_feature_scene=source_code,production_approved=False)
    for row,start in zip(lines,starts):
        identity=row['recording_id'];audio=root/'data/speech-audit'/f'{identity}.mp3'
        assert hashlib.sha256(audio.read_bytes()).hexdigest()==row['audio_sha256']
        shutil.copyfile(audio,runtime/'audio'/audio.name)
        line=dict(id=identity,speaker=row['character'],text_hu=row['text_hu'],start=start,end=start+row['duration_sec'],audio='audio/'+audio.name,audio_sha256=row['audio_sha256'])
        track=root/'data/speech-v023'/f'{identity}.visemes.json'
        if row.get('viseme_storage_key') and track.exists():
            shutil.copyfile(track,runtime/'audio'/track.name);line['visemes']='audio/'+track.name;scene['dialogue'].append(line)
        else:
            line['review_required']=True;line['staging']='offscreen; unresolved take, not approved';scene['offscreen_dialogue'].append(line)
    for i,(start,kind,description) in enumerate(shots):
        pos,target,lens=presets[kind];pos=pos.copy();target=target.copy()
        if source_code=='S1E1_SC003' and kind in ('M','L'):pos[1]-=.4;target[1]-=.4
        end=shots[i+1][0] if i+1<len(shots) else duration
        camera=dict(start=start,position=pos,target=target,lens=lens,end_position=[pos[0]+(.12 if i%2==0 else -.12),pos[1]+.08,pos[2]],end_target=target)
        scene['cameras'].append(camera)
        storyboard.append(dict(shot_id=f'{source_code}_SH{i+1:03}',scene_id=scene['id'],start_sec=start,end_sec=end,duration_sec=end-start,camera=camera,direction_hu=description,frame_start=round(start*24)+1,frame_end=round(end*24),timing_basis='authored blocking, existing measured recordings',animation_render_verified=False))
    if source_code=='S1E1_SC003':scene['interactions']=[dict(id='star',kind='pickup',character='CHAR_MARK',hand='L',position=[-.1,-1.35,.23],start=20,end=26,radius=.055,carry_to_end=True)]
    validate_scene(scene,reg);data=json.dumps(scene,ensure_ascii=False,indent=2)+'\n'
    (dest/(scene['id']+'.script.json')).write_text(data);(runtime/(scene['id']+'.script.json')).write_text(data);scenes.append(scene)
episode=dict(schema='WONDERLY_EPISODE_V1',id='FEATURE_V002_OPENING_V024',kind='quality_trial',scenes=scenes,target_duration_seconds=132)
plan=compile_episode(episode,reg)
package=dict(schema='WONDERLY_STORYBOARD_V1',source_feature_sha256=hashlib.sha256(feature_path.read_bytes()).hexdigest(),duration_seconds=132,actual_rendered_duration=None,shots=storyboard,unresolved_audio_ids=[l['id'] for s in scenes for l in s['offscreen_dialogue']],full_feature_duration_verified=False,production_approved=False)
(dest/'storyboard_132s_V024.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
(dest/'render_plan_132s_V024.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print('OPENING_PREPARED',len(storyboard),'shots',len(scenes),'scenes',plan['frames'],'frames',len(plan['jobs']),'bounded jobs')
