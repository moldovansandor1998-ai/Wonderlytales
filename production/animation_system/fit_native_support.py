"""Opt-in diagnostic support bake. Reject infeasible or worsening corrections."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.support import fit_support
from animation_system.spec import digest,atomic_json
src,registry,out=map(Path,sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(src.resolve()),use_scripts=False);reg=json.loads(registry.read_text());scene=bpy.context.scene
spec=reg['characters']['CHAR_LILI'];r=bpy.data.objects[spec['rig']];pelvis=r.pose.bones['CTRL_pelvis'];report={'source_sha256':digest(src),'production_approved':False,'corrections':[],'rejected':[]}
frames=sorted(set(range(1,scene.frame_end+1,24))|set(range(21,130))|set(range(231,300)))
def sample():
 dep=bpy.context.evaluated_depsgraph_get();ev=r.evaluated_get(dep);hips=[];targets=[];lengths=[];errors=[]
 for foot in spec['feet']:
  hips.append(list(ev.matrix_world@ev.pose.bones[foot['upper']].head));targets.append(list(ev.matrix_world@ev.pose.bones[foot['control']].head));lengths.append(sum(ev.data.bones[n].length for n in [foot['upper'],foot['lower']])*ev.matrix_world.to_scale().x)
  errors.append(((ev.matrix_world@ev.pose.bones[foot['lower']].tail)-Vector(targets[-1])).length)
 return hips,targets,lengths,errors
for f in frames:
 scene.frame_set(f);hips,targets,lengths,errors=sample()
 if max(errors)<.005:continue
 shift,residual=fit_support(hips,targets,lengths)
 if residual>.002 or Vector(shift).length>.12:report['rejected'].append({'frame':f,'reason':'infeasible_or_large','residual':residual});continue
 original=pelvis.location.copy();local=r.matrix_world.inverted().to_3x3()@Vector(shift);pelvis.location=original+pelvis.bone.matrix_local.to_3x3().inverted()@local;r.update_tag();bpy.context.view_layer.update();after=sample()[3]
 if max(after)>max(errors) or max(after)>.006:
  pelvis.location=original;report['rejected'].append({'frame':f,'reason':'evaluated_error','before':max(errors),'after':max(after)});continue
 pelvis.keyframe_insert('location',frame=f);report['corrections'].append({'frame':f,'world_shift':shift,'before':max(errors),'after':max(after)})
 if f%24==1:print('SUPPORT',f,flush=True)
scene['production_approved']=False;scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out.resolve()),compress=True);report['candidate_sha256']=digest(out);atomic_json(out.with_suffix('.support.json'),report);print('SUPPORT_DONE',len(report['corrections']),len(report['rejected']),flush=True)
