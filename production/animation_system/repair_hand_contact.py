import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json
from animation_system.contact_fit import fit_hand_contact
source,registry,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New source required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;asset=json.loads(registry.read_text())['characters']['CHAR_MARK']
report={'source_sha256':digest(source),'contact':fit_hand_contact(scene,bpy.data.objects[asset['body']],bpy.data.objects[asset['rig']],bpy.data.objects['PROP_STAR_SHARD'],'L',560),'production_approved':False}
scene.frame_set(1);dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True);report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.contact-fit.json'),report);print(json.dumps(report),flush=True)
