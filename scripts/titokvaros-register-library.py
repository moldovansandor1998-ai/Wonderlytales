"""Generate idempotent DATA-ONLY registration of newly published native assets."""
import json,uuid
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=root/'production/titokvaros';ids=json.loads((p/'ids.json').read_text());libs=json.loads((p/'published-libraries.json').read_text())['assets'];motion=json.loads((p/'published-motion.json').read_text())['actions'];prefix='native/S1E1/TITOKVAROS/V001/';project='a2b6d64a-08a0-474f-b7c0-fa71121b00ab'
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'wonderlytales:titokvaros:'+s))
def q(s):return "'"+str(s).replace("'","''")+"'"
def asset_id(file):return uid('asset:'+file)
sql=['begin;']
assets={a['file']:a for a in libs}
for m in motion:assets.setdefault(m['file'],dict(m,id='TV_MOTION_'+m['character'],role='motion'))
for file,a in assets.items():
 kind={'character':'CHARACTER_MODEL','environment':'LOCATION_BLEND','motion':'ANIMATION'}.get(a['role'],'BLENDER_LIBRARY')
 meta={'series':'TITOKVAROS','production_approved':False,'stage':'DEVELOPMENT','role':a['role']}
 sql.append('insert into assets(id,project_id,kind,storage_provider,object_key,mime_type,size_bytes,sha256,metadata,asset_code,version,path,mime,size) values ('+','.join(map(q,[asset_id(file),project,kind,'r2',prefix+file,'application/octet-stream']))+f",{a['bytes']},"+q(a['sha256'])+','+q(json.dumps(meta))+'::jsonb,'+','.join(map(q,[a['id'],'V001',prefix+file,'application/octet-stream']))+f",{a['bytes']}) on conflict (storage_provider,object_key) do nothing;")
for code in ['MIRA','BRUNO','KIPP']:
 file='TV_CHAR_'+code+'_V001.blend';aid=asset_id(file);scale={'MIRA':177,'BRUNO':186,'KIPP':148}[code]
 sql.append('insert into character_versions(id,character_id,version,model_asset_id,rig_asset_id,facial_profile,default_costume_code,scale_cm,status,master_model_path,rig_profile,viseme_profile,retarget_profile) values ('+','.join(map(q,[uid('char-version:'+code+':V001'),ids['characters'][code],'V001',aid,aid,'TV_HU_DEV_6_VISEMES','TV_'+code+'_DEFAULT']))+f',{scale},'+','.join(map(q,['DEVELOPMENT_UNAPPROVED',prefix+file,'RIGIFY_ANIMAL_DEV_V001','HU_CHAR_ALIGNMENT_DEV_V001','TV_'+code+'_RIGIFY']))+') on conflict (character_id,version) do nothing;')
for m in motion:
 sql.append('insert into animations(id,code,name,category,source_asset_id,skeleton_profile,duration_sec,loopable,metadata,status,source_asset) values ('+','.join(map(q,[uid('action:'+m['action']),m['action'],m['character']+' '+('járás' if '_WALK_' in m['action'] else 'futás')+' fejlesztési ciklus','LOCOMOTION',asset_id(m['file']),'TV_'+m['character']+'_RIGIFY']))+f",{m['cycle_frames']/24},true,"+q(json.dumps(m))+'::jsonb,'+','.join(map(q,['DEVELOPMENT_UNAPPROVED',prefix+m['file']]))+') on conflict (code) do nothing;')
file='TV_ENV_REZRAKPART_V001.blend';sql.append('insert into location_versions(id,location_id,version,blend_asset_id,metadata,status) select '+q(uid('location-version:REZRAKPART:V001'))+',id,\'V001\','+q(asset_id(file))+',\'{"production_approved":false,"stage":"DEVELOPMENT"}\'::jsonb,\'DEVELOPMENT_UNAPPROVED\' from locations where series_id='+q(ids['series'])+' and code=\'TV_REZRAKPART\' on conflict(location_id,version) do nothing;')
sql.append('commit;');(p/'register-libraries.sql').write_text('\n'.join(sql)+'\n');print(json.dumps({'new_asset_records':len(assets),'character_versions':3,'animation_records':len(motion),'location_versions':1}))
