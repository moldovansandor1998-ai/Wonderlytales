import bpy,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.aperture import refine_eye_opening
from animation_system.spec import digest,atomic_json
source,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New candidate required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);bpy.context.scene.frame_set(1)
report={'source_sha256':digest(source),'aperture':refine_eye_opening('CHAR_MARK'),'production_approved':False};dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True);report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.aperture.json'),report)
