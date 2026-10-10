"""Freeze a separate reusable candidate, preserving V022 action and cast identity."""
import bpy,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.continuous_binding import rebind_body
from animation_system.refine_skin_continuity import stabilize_mouth
from animation_system.spec import digest,atomic_json,FACE_PROFILES,QUADRUPEDS
source,registry,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve():raise ValueError('Immutable V022 required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
reg=json.loads(registry.read_text());report={'source_sha256':digest(source),'blender':bpy.app.version_string,'production_approved':False,'characters':{}}
for code in ('CHAR_LILI','CHAR_POTTY','CHAR_ZIZI'):
    a=reg['characters'][code];r=bpy.data.objects[a['rig']];body=bpy.data.objects[a['body']]
    report['characters'][code]=rebind_body(body,r,code,FACE_PROFILES[code]['head_floor'],code in QUADRUPEDS)
    if code=='CHAR_ZIZI':stabilize_mouth(bpy.data.objects[code+'_FACIAL_TOPOLOGY'])
    print('MASTER_BOUND',code,flush=True)
bpy.context.scene['production_approved']=False;bpy.context.scene['status']='V024_REUSABLE_CANDIDATE';bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
sha=digest(dest);report['candidate_sha256']=sha;reg['source_sha256']=digest(source);reg['version']='V024';reg['master_file']=dest.name
for a in list(reg['characters'].values())+list(reg['locations'].values()):a['asset_sha256']=sha
reg['professional_quality_approved']=False
atomic_json(dest.with_suffix('.binding.json'),report);atomic_json(dest.parent/('asset_registry_'+dest.stem.removeprefix('MASTER_CAST_')+'.json'),reg)
