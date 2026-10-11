"""Emit idempotent data-only SQL for the existing Studio (no schema changes)."""
import json
import uuid
from pathlib import Path

root=Path(__file__).resolve().parents[1]
b=json.loads((root/'production/titokvaros/bible/series.json').read_text())
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'wonderlytales:Titokvaros:'+s))
def q(s):return "'"+str(s).replace("'","''")+"'"
series=uid('series');season=uid('S1')
sql=["begin;", "update public.series set status='ARCHIVED', updated_at=now() where id='b3489658-af88-406e-aabd-a8d4cd49adf2';"]
sql.append(f"insert into public.series(id,project_id,name,international_name,bible,age_range,target_age_min,target_age_max,status,visual_style) values ({q(series)},'a2b6d64a-08a0-474f-b7c0-fa71121b00ab',{q(b['title'])},'Titokvaros',{q(b['logline'])},'8+',8,99,'DEVELOPMENT','eredeti filmes 3D, Rigify, natív Blender') on conflict(id) do nothing;")
sql.append(f"insert into public.seasons(id,series_id,season_number,number,title,arc,status) values({q(season)},{q(series)},1,1,'Az elfeledett város',{q(b['theme'])},'DEVELOPMENT') on conflict(id) do nothing;")
for e in b['season']:
    sql.append(f"insert into public.episodes(id,season_id,episode_number,number,title,target_duration_sec,language,master_language,brief,story_brief,script_version,status) values({q(uid('S1E'+str(e['number'])))},{q(season)},{e['number']},{e['number']},{q(e['title'])},3600,'hu','hu',{q(e['adventure'])},{q(json.dumps(e,ensure_ascii=False))},'TV_V001','DEVELOPMENT') on conflict(id) do nothing;")
for c in b['characters']:
    sql.append(f"insert into public.characters(id,series_id,code,name,species,role_type,type,gender,age_description,personality,visual_description,speech_style,status) values({q(uid(c['code']))},{q(series)},{q('TV_'+c['code'])},{q(c['name'])},{q(c['species'])},'CORE','CORE',{q(c['gender'])},{q(str(c['age'])+' éves')},{q(json.dumps(c,ensure_ascii=False))}::jsonb,{q(c['appearance'])},{q(c['voice'])},'DESIGN') on conflict(id) do nothing;")
for d in b['districts']:
    sql.append(f"insert into public.locations(id,series_id,code,name,status) values({q(uid(d['code']))},{q(series)},{q('TV_'+d['code'])},{q(d['name'])},'DESIGN') on conflict(id) do nothing;")
sql += ['commit;',f"select id,name,status from public.series where id in ({q(series)},'b3489658-af88-406e-aabd-a8d4cd49adf2');"]
out=root/'production/titokvaros/seed.sql';out.write_text('\n'.join(sql)+'\n')
ids={'series':series,'season':season,'episodes':{str(i):uid('S1E'+str(i)) for i in range(1,7)},'characters':{c['code']:uid(c['code']) for c in b['characters']}}
(root/'production/titokvaros/ids.json').write_text(json.dumps(ids,indent=2)+'\n')
print(out.read_text())
