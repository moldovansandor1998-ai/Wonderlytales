import bpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.lid_clearance import conform_lids
from animation_system.spec import digest,atomic_json
source,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New source required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;scene.frame_set(1)
rigs={o.get('character_code'):o for o in scene.objects if o.type=='ARMATURE' and o.get('character_code')}
report={'source_sha256':digest(source),'repairs':conform_lids(scene,rigs),'production_approved':False}
dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True);report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.clearance.json'),report)
