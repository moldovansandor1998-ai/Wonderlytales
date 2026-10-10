"""Compile the preserved 40-unit draft into traceable editorial shot/read sheets.

Duration estimates never become measured performance or a 60-minute claim.
Native opening shots keep their existing authored timing. No TTS is called.
"""
import hashlib, html, json, math, pathlib

ROOT=pathlib.Path(__file__).resolve().parents[1]
DIR=ROOT/'production/episodes/S1E1/feature_V002'
source=DIR/'feature_scene_plan_V002.json'
feature=json.loads(source.read_text());notes=json.loads((DIR/'director_notes_V024.json').read_text())
opening=json.loads((DIR/'quality_opening_V024/storyboard_132s_V024.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
names={'CHAR_MARK':'Márk','CHAR_LILI':'Lili','CHAR_MORZSI':'Morzsi','CHAR_POTTY':'Pötty','CHAR_ZIZI':'Zizi','CHAR_BOGYO':'Bogyó'}
voices={};existing=[]
for scene in feature['scenes']:
    for beat in scene['beats']:
        if beat['kind']=='DIALOGUE' and beat.get('audio_storage_key'):
            voice=beat['audio_storage_key'].split('/')[3]
            if beat['character'] in voices and voices[beat['character']]!=voice:raise ValueError('Conflicting accepted character voice')
            voices[beat['character']]=voice;existing.append(beat['dialogue_id'])
expected_voices={'CHAR_MARK':'vmhWRuUG7LqpLLPY9sM1','CHAR_LILI':'jcrKkDTF93Hvb8jBABwM',
 'CHAR_MORZSI':'tWNlc7uUtaorMxxrhH9s','CHAR_POTTY':'gvuelryL3NskaN44p9vz','CHAR_ZIZI':'8ik405hgdHADnz9lglMf'}
if voices!=expected_voices:raise ValueError('Accepted voice bindings changed')
board={'schema':'WONDERLY_FEATURE_STORYBOARD_V024','source_sha256':sha(source),
 'director_notes_sha256':sha(DIR/'director_notes_V024.json'),'source_dialogue_count':244,
 'production_approved':False,'performed_reading_verified':False,'actual_duration_sec':None,
 'target_duration_sec':3600,'timing_note':'Native opening 132 s; other timings are manual action allowances plus existing audio lengths and unperformed new-dialogue estimates. No target-duration padding.',
 'scenes':[]}
reading={'schema':'WONDERLY_TIMED_READING_V024','source_sha256':sha(source),
 'script_finalized':False,'performed_reading_verified':False,'actual_duration_sec':None,'rows':[]}
new={'schema':'WONDERLY_NEW_RECORDINGS_V024','source_sha256':sha(source),
 'generation_allowed':False,'required_gates':['script_finalized','performed_reading_verified','character_voice_binding_verified','daily_budget_reserved'],
 'accepted_voice_ids':voices,'rows':[]}
clock=0.;dialogue_ids=[]
for scene in feature['scenes']:
    code=scene['scene_code'];beats=scene['beats'];native=code in ('S1E1_SC001','S1E1_SC003')
    info={'scene_code':code,'title_hu':scene['title_hu'],'source_planned_duration_sec':scene['planned_duration_sec'],
          'editorial_start_sec':round(clock,3),'performed_duration_sec':None,'native_3d_blocked':native,
          'director_notes_ref':code if code in notes['scenes'] else None,'shots':[]}
    if code=='S1E1_INTRO_V016':
        info['shots']=[dict(shot_id=code+'_REUSE',kind='ACCEPTED_ASSET_REUSE',start_sec=0,end_sec=15,asset_sha256=scene['asset']['sha256'],rerender=False,beat_indices=[])]
    elif native:
        script=json.loads((DIR/f'quality_opening_V024/{code}_V024.script.json').read_text())
        cues=script.get('dialogue',[])+script.get('offscreen_dialogue',[])
        for shot in [s for s in opening['shots'] if s['scene_id']==code+'_V024']:
            ids=[c['id'] for c in cues if shot['start_sec']<=c['start']<shot['end_sec']]
            info['shots'].append(dict(shot_id=shot['shot_id'],kind='NATIVE_BLOCKING',
                start_sec=shot['start_sec'],end_sec=shot['end_sec'],camera=shot['camera'],
                direction_hu=shot['direction_hu'],dialogue_ids=ids,beat_indices=[],
                timing_basis='authored native opening; GPU completion tracked separately'))
    else:
        direction=notes['scenes'][code];action_times=iter(direction['action_seconds']);t=0.;i=0
        while i<len(beats):
            beat=beats[i];indices=[i]
            if beat['kind']=='ACTION':
                seconds=next(action_times);kind='ACTION';lens=35 if not info['shots'] else 50
                timing='director action allowance; not performed';i+=1;ids=[]
            elif beat['kind']=='DIALOGUE':
                i+=1
                if i<len(beats) and beats[i]['kind']=='DIALOGUE':indices.append(i);i+=1
                seconds=0.;ids=[]
                for index in indices:
                    b=beats[index];ids.append(b['dialogue_id'])
                    seconds+=b.get('duration_sec') or max(1.1,len(b['text_hu'].split())/2.1)
                    seconds+=.45
                seconds+=.35;kind='DIALOGUE_COVERAGE';lens=55;timing='source recording durations where present; 2.1 words/s draft estimate otherwise'
            else:raise ValueError('Unknown beat kind')
            seconds=math.ceil(seconds*24)/24
            info['shots'].append(dict(shot_id=f'{code}_BD{len(info["shots"])+1:03d}',kind=kind,
                start_sec=round(t,3),end_sec=round(t+seconds,3),beat_indices=indices,dialogue_ids=ids,
                lens_mm_draft=lens,framing_hu='Térbeli akciót követő közös kép' if kind=='ACTION' else 'Beszélő és hallgató közös képe; a reakció a mondat után marad',
                timing_basis=timing));t+=seconds
    duration=info['shots'][-1]['end_sec'];info['editorial_duration_sec']=duration
    info['difference_from_old_plan_sec']=round(duration-scene['planned_duration_sec'],3)
    for index,beat in enumerate(beats):
        if beat['kind']!='DIALOGUE':continue
        identifier=beat['dialogue_id'];dialogue_ids.append(identifier)
        matches=[s for s in info['shots'] if identifier in s.get('dialogue_ids',[])]
        if len(matches)!=1:raise ValueError('Each dialogue must bind to one storyboard shot')
        row={'dialogue_id':identifier,'scene_code':code,'source_beat_index':index,'shot_id':matches[0]['shot_id'],
             'character':beat['character'],'text_hu':beat['text_hu'],'text_sha256':hashlib.sha256(beat['text_hu'].encode()).hexdigest(),
             'voice_id':voices[beat['character']],'existing_recording':bool(beat.get('audio_storage_key')),
             'recording_status':beat.get('recording_status'),'audio_storage_key':beat.get('audio_storage_key'),
             'audio_sha256':beat.get('audio_sha256'),'recorded_duration_sec':beat.get('duration_sec'),
             'performed_reading_start_sec':None,'performed_reading_duration_sec':None,
             'director_delivery_hu':beat.get('direction',''),'auditory_approved':False}
        reading['rows'].append(row)
        if not row['existing_recording']:
            new['rows'].append({**row,'tts_model_id':'eleven_v3' if beat['character'] in ('CHAR_MARK','CHAR_LILI','CHAR_MORZSI') else 'eleven_flash_v2_5',
                               'language_code':'hu','generation_status':'BLOCKED_UNTIL_SCRIPT_AND_READING_FINAL'})
    board['scenes'].append(info);clock+=duration
assert len(board['scenes'])==40 and len(dialogue_ids)==len(set(dialogue_ids))==244
assert len(existing)==131 and len(new['rows'])==113
board['editorial_duration_sec']=round(clock,3)
board['target_gap_sec']=round(3600-clock,3)
board['shot_count']=sum(len(s['shots']) for s in board['scenes'])
board['unperformed_estimates']=True
for name,data in [('storyboard_V024.json',board),('timed_reading_V024.json',reading),('new_recording_manifest_V024.json',new)]:
    (DIR/name).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')

# Offline editorial document: every line is traceable to the immutable source.
e=html.escape
def layout_svg(code):
    native=code in ('S1E1_SC001','S1E1_SC003','S1E1_SC018')
    actors=list(names)[:2] if native else list(names)
    positions=[(215,115),(305,115),(135,185),(365,185),(200,245),(325,245)]
    colors=['#f49a79','#e9c6ef','#b8976d','#dde3f0','#edca69','#b8d5b0']
    parts=['<svg viewBox="0 0 500 310" role="img" aria-label="Felülnézeti blokkolási vázlat">',
           '<rect width="500" height="310" fill="#edf1ea"/><path d="M250 290 L250 35" stroke="#becbb3" stroke-width="70"/>',
           '<rect x="218" y="28" width="64" height="38" rx="9" fill="#b8c9bd"/><text x="250" y="51" text-anchor="middle" font-size="12">akciópont</text>',
           '<path d="M455 265 L300 85 L130 250 Z" fill="#429dac" opacity=".11"/><circle cx="455" cy="265" r="10" fill="#217f90"/><text x="420" y="295" font-size="12">kameraoldal</text>']
    for c,(x,y),color in zip(actors,positions,colors):
        parts.append(f'<circle cx="{x}" cy="{y}" r="23" fill="{color}" stroke="#394437"/><text x="{x}" y="{y+4}" text-anchor="middle" font-size="12">{names[c]}</text>')
    parts.append('<text x="12" y="302" font-size="10">Jelképes térvázlat; a pontos helyzetet a blokkolási szöveg és a natív forrás rögzíti.</text></svg>')
    return ''.join(parts)
parts=['<!doctype html><html lang="hu"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Csodakapu – FEATURE V002 / V024 storyboard</title>',
'''<style>body{margin:0;background:#f3f2ee;color:#21362e;font:16px/1.55 system-ui}main{max-width:1120px;margin:auto;padding:40px 24px}h1{font-size:38px;line-height:1.15}h2{font-size:26px}h3{font-size:18px}aside,.notice{background:#e1ebe5;padding:18px;border-radius:12px}section{margin:30px 0;background:white;padding:26px;border-radius:18px;break-before:page}.grid{display:grid;grid-template-columns:1fr 1fr;gap:25px}.grid svg{width:100%;border-radius:12px}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid #d9e0db}.shot{padding:16px 0;border-bottom:1px solid #d9e0db}.meta{font-size:13px;color:#63776d}button{padding:10px;margin:6px;border:0;border-radius:8px;background:#285f4b;color:white;cursor:pointer}a{color:#225f53}.cue{font-weight:600}#reading{position:sticky;top:0;background:#f3f2eef5;padding:12px;border-bottom:1px solid #bbcabe;z-index:2}@media(max-width:700px){.grid{display:block}h1{font-size:29px}section{padding:18px}}@media print{#reading{display:none}}</style>''',
 '<main><p class="meta">WONDERLYTALES · CSODAKAPU · A CSILLAGSZILÁNK</p><h1>Negyven jelenetegység.<br>Egy követhető közös történet.</h1>',
 f'<aside>244 megőrzött megszólalás · 131 meglévő történeti hang · 113 még fel nem vett sor · {board["shot_count"]} storyboard-beállítás.<br>A natívan blokkolt nyitány 132 másodperc. A további időzítés szerkesztői becslés; a teljes történet előadott ideje még nincs igazolva.</aside>',
 f'<p>A tartalomból levezetett munkaváltozat ideje <b>{int(clock//60)} perc {int(clock%60)} másodperc</b>. Ez nem kész filmhossz. A 60 perces célhoz képesti különbséget nem töltjük ki állóképekkel vagy megismételt eseményekkel.</p>',
 '<div id="reading"><button id="start">Olvasópróba indítása</button><button id="next">Következő megszólalás</button><button id="export">Mért idők mentése</button><span id="counter">Még nincs mért olvasópróba.</span><p id="cue" class="cue"></p><p class="meta">A gombok ténylegesen mért szakaszidőket mentenek; a szöveg megjelenítése vagy az időzítő elindítása önmagában nem igazolja az előadást. Hangfelvétel nem készül.</p></div>',
 '<p>'+ ' · '.join(f'<a href="#{s["scene_code"]}">{e(s["scene_code"].removeprefix("S1E1_"))}</a>' for s in board['scenes'])+'</p>']
for original,scene in zip(feature['scenes'],board['scenes']):
    code=scene['scene_code'];note=notes['scenes'].get(code)
    parts.append(f'<section id="{code}"><p class="meta">{code} · {scene["editorial_duration_sec"]:.1f} s szerkesztői idő · korábbi keret {scene["source_planned_duration_sec"]} s</p><h2>{e(scene["title_hu"])}</h2>')
    if note:
        parts.append('<div class="grid"><div>'+layout_svg(code)+f'<p>{e(note["intent"])}</p></div><div><h3>Blokkolás</h3><p>{e(note["blocking"])}</p><h3>Kamera</h3><p>{e(note["camera"])}</p></div></div>')
        parts.append(f'<p><b>Hang:</b> {e(note["sound"])}</p><p><b>Folytonosság:</b> {e(note["continuity"])}</p>')
    elif code=='S1E1_INTRO_V016':parts.append('<p>Elfogadott V016 főcím újrafelhasználása. Nem renderelendő újra.</p>')
    else:parts.append('<p>A natív Blender 4.5.3 nyitány kameráiból és időzítéséből átvett beállítások. GPU-feladatok és minőségi korlátok külön manifestben.</p>')
    for shot in scene['shots']:
        parts.append(f'<div class="shot"><h3>{shot["shot_id"]} · {shot["start_sec"]:.2f}–{shot["end_sec"]:.2f} s</h3>')
        if shot.get('direction_hu'):parts.append('<p>'+e(shot['direction_hu'])+'</p>')
        if shot.get('camera'):parts.append('<p class="meta">'+e(json.dumps(shot['camera'],ensure_ascii=False))+'</p>')
        for index in shot['beat_indices']:
            b=original['beats'][index]
            parts.append('<p>'+ (f'<b>{names[b["character"]]}:</b> {e(b["text_hu"])}' if b['kind']=='DIALOGUE' else e(b['direction_hu']))+'</p>')
        if scene['native_3d_blocked']:
            for identifier in shot.get('dialogue_ids',[]):
                b=next(b for b in original['beats'] if b.get('dialogue_id')==identifier)
                parts.append(f'<p><b>{names[b["character"]]}:</b> {e(b["text_hu"])}</p>')
        parts.append('</div>')
    parts.append('</section>')
payload=json.dumps(reading,ensure_ascii=False).replace('</','<\\/')
parts.append('''<script>const reading='''+payload+''';let index=-1,started=null,previous=null;const measured=[];
const show=()=>{document.getElementById('counter').textContent=index<reading.rows.length?`${index+1} / ${reading.rows.length}`:'Vége';const r=reading.rows[index];document.getElementById('cue').textContent=r?`${r.scene_code} · ${r.character}: ${r.text_hu}`:'Az olvasópróba szakaszidejei exportálhatók.';};
document.getElementById('start').onclick=()=>{if(started!==null)return;started=performance.now();previous=started;index=0;show();};
document.getElementById('next').onclick=()=>{if(started===null||index>=reading.rows.length)return;const now=performance.now();measured.push({dialogue_id:reading.rows[index].dialogue_id,elapsed_start_sec:(previous-started)/1000,elapsed_duration_sec:(now-previous)/1000,performed_audio_verified:false});previous=now;index++;show();};
document.getElementById('export').onclick=()=>{const output={source_sha256:reading.source_sha256,completed_rows:measured.length,expected_rows:244,performed_audio_verified:false,measured_rows:measured};const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));link.href=url;link.download='Csodakapu_olvasoproba_idok.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};</script></main></html>''')
out=ROOT/'data/V024/Csodakapu_FEATURE_V002_storyboard_V024.html';out.write_text(''.join(parts))
report={'source_sha256':sha(source),'scene_count':40,'dialogue_count':244,'existing_recordings':131,
 'new_recordings':113,'shot_count':board['shot_count'],'native_opening_sec':132,
 'editorial_estimate_sec':board['editorial_duration_sec'],'target_gap_sec':board['target_gap_sec'],
 'performed_duration_sec':None,'padding_added_sec':0,'tts_generated':0,
 'html_sha256':sha(out),'production_approved':False}
(ROOT/'ops/feature-storyboard-v024-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
