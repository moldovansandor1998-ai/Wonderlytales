"""Apply measured transition and skin fixes to a separate native candidate."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.motion import support_shift
from animation_system.refine_skin_continuity import smooth_skin,stabilize_mouth
from animation_system.spec import digest,atomic_json

def main(source,registry_path,script_path,dest):
 reg=json.loads(registry_path.read_text());script=json.loads(script_path.read_text());bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
 report={'source_sha256':digest(source),'blender':bpy.app.version_string,'production_approved':False,'repairs':{}}
 for actor in script['characters']:
  c=actor['code'];a=reg['characters'][c];r=bpy.data.objects[a['rig']];pelvis=r.pose.bones['CTRL_pelvis'];basis=pelvis.bone.matrix_local.to_3x3().inverted()
  for f in range(1,bpy.context.scene.frame_end+1):
   pelvis.location=basis@Vector(support_shift(actor,(f-1)/24));pelvis.keyframe_insert('location',frame=f)
  entry={'continuous_pelvis_frames':bpy.context.scene.frame_end}
  # Broad weight diffusion regressed Lili's mouth edge in measured QA; disabled.
  entry['skin_diffusion_applied']=False
  if c=='CHAR_ZIZI':entry['mouth']=stabilize_mouth(bpy.data.objects[c+'_FACIAL_TOPOLOGY'])
  report['repairs'][c]=entry;print('REPAIRED',c,json.dumps(entry),flush=True)
 bpy.context.scene['production_approved']=False;bpy.context.scene['status']='V023_CANDIDATE_NOT_RELEASED';bpy.context.scene.frame_set(1)
 bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True);report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.repair.json'),report)
if __name__=='__main__':main(*map(Path,sys.argv[sys.argv.index('--')+1:]))
