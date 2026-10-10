"""Keep the V024 scene and add a separate native articulated grip candidate."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.hand_rig import add_digits,MARK_RIGHT,bake_grip
from animation_system.interactions import author_supported_interactions
from animation_system.grip import bake_attachment
from animation_system.spec import digest,atomic_json
source,script_path,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New candidate path required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;scene.frame_set(1)
script=json.loads(script_path.read_text());rigs={o.get('character_code'):o for o in scene.objects if o.type=='ARMATURE' and o.get('character_code')}
report={'source_sha256':digest(source),'script_sha256':digest(script_path),'production_approved':False}
rig=rigs['CHAR_MARK'];body=max((o for o in scene.objects if o.type=='MESH' and o.parent==rig),key=lambda o:len(o.data.vertices))
event=script['interactions'][0];side=event.get('hand','R');sign=1 if side=='R' else -1;y_shift=0. if side=='R' else .05
landmarks={name:[(p[0]*sign,p[1]+y_shift,p[2]) for p in points] for name,points in MARK_RIGHT.items()}
report['digits']=add_digits(body,rig,side,landmarks)
event['contact_landmark_local']=[-.193*sign,-.113+y_shift,.361]
from animation_system.evaluation import rig_only_evaluation
with rig_only_evaluation(scene):
 report['contact']=author_supported_interactions(scene,script,rigs)
print('CONTACT_QC',json.dumps(report['contact']),flush=True)
if not report['contact'][0]['grasp_contact_pass']:raise ValueError('Native grasp handoff failed; do not save or render this candidate')
grasp=report['contact'][0]['grasp_frame'];bake_grip(scene,rig,side,grasp)
proxy=bpy.data.objects['PROP_'+event['id']];proxy.hide_render=True
star=bpy.data.objects['PROP_STAR_SHARD'];scarf=bpy.data.objects['PROP_FOLDED_SCARF']
for frame in range(scene.frame_start,scene.frame_end+1):
 scene.frame_set(frame);star.location=proxy.location;star.keyframe_insert('location',frame=frame);scarf.location=proxy.location+Vector((0,0,-.022));scarf.keyframe_insert('location',frame=frame)
report['attachment']=bake_attachment(scene,rig,side,[star,scarf],grasp)
scene.frame_set(1);dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.grip.json'),report);print('GRIP_REPORT',json.dumps(report),flush=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.resolution_x=960;scene.render.resolution_y=540;scene.render.resolution_percentage=100;scene.render.use_sequencer=False
for frame in (541,grasp,1153):
 scene.frame_set(frame);scene.render.filepath=str(dest.parent/f'grip_{frame:04d}.png');bpy.ops.render.render(write_still=True)
