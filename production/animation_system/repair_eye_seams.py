"""Versioned, non-destructive eye-seam authoring and evaluated proof export."""
import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.facial_seams import repair_eyelid
from animation_system.spec import digest,atomic_json
from animation_system.gaze import stabilize_sclera
source,dest,codes=sys.argv[sys.argv.index('--')+1:]
source,dest=Path(source),Path(dest)
if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New candidate output required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
s=bpy.context.scene;s.frame_set(1);report=[]
for code in codes.split(','):
 rig=next(o for o in s.objects if o.type=='ARMATURE' and o.get('character_code')==code)
 body=max((o for o in s.objects if o.type=='MESH' and o.parent==rig),key=lambda o:len(o.data.vertices))
 stabilize_sclera(code,rig)
 for side in ('R','L'):
  report.append(repair_eyelid(s,code,rig,body,side));print('EYE_REPAIRED',report[-1],flush=True)
from animation_system.seam_edges import coalesce_existing_seams
for code in codes.split(','):
 rig=next(o for o in s.objects if o.type=='ARMATURE' and o.get('character_code')==code)
 body=max((o for o in s.objects if o.type=='MESH' and o.parent==rig),key=lambda o:len(o.data.vertices))
 report.append(coalesce_existing_seams(body))
dest.parent.mkdir(parents=True,exist_ok=True);s['production_approved']=False
bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
atomic_json(dest.with_suffix('.eye-seams.json'),{'source_sha256':digest(source),'candidate_sha256':digest(dest),'eyes':report,'production_approved':False})
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100;s.render.use_sequencer=False
for frame in (217,1060):
 s.frame_set(frame);s.render.filepath=str(dest.parent/f'proof_{frame:04d}.png');bpy.ops.render.render(write_still=True)
