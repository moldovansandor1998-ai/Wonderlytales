"""Refine a separate existing scene through reusable V025 animation modules."""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json
from animation_system.build_scene import terrain,set_target
from animation_system.motion import root_at,foot_at,foot_heading
from animation_system.support import fit_support
from animation_system.performance import apply_performance
from animation_system.forest import finish_forest,finish_cameras
from animation_system.gaze import bake_bounded_gaze
from animation_system.evaluation import rig_only_evaluation


def refine_motion(scene,script,registry,rigs):
    actors={a['code']:a for a in script['characters']};floor=terrain(scene)
    for actor in actors.values():
        for action in actor.get('actions',[]):
            if action.get('look_at'):
                own=root_at(actor,action['start'])[0];target=root_at(actors[action['look_at']],action['end'])[0]
                action['yaw']=math.atan2(target[0]-own[0],own[1]-target[1])
    stats={c:{'max_ankle_target_error_m':0.,'max_support_correction_m':0.,'max_planted_slide_m':0.} for c in rigs};prior={}
    with rig_only_evaluation(scene):
        for frame in range(scene.frame_start,scene.frame_end+1):
            scene.frame_set(frame);t=(frame-1)/scene.render.fps
            for code,rig in rigs.items():
                asset=registry['characters'][code];actor=actors[code];support=[]
                for foot in asset['feet']:
                    spec={**foot,'leg_length':sum(rig.data.bones[n].length for n in (foot['upper'],foot['lower']))}
                    q,planted,contact=foot_at(actor,spec,t,asset['scale'])
                    lift=max(0,q[2]-root_at(actor,t)[0][2]-foot['ankle'][2]*asset['scale'])
                    q[2]=floor(q[0],q[1])+(foot['ankle'][2]-foot['sole_z'])*asset['scale']+.003+lift
                    set_target(rig,foot['control'],q,foot_heading(actor,spec,t));support.append((foot,Vector(q),planted,contact))
                rig.update_tag();bpy.context.view_layer.update();total=Vector((0,0,0))
                for _ in range(4):
                    ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
                    hips=[list(ev.matrix_world@ev.pose.bones[f['upper']].head) for f,_,_,_ in support]
                    targets=[list(q) for _,q,_,_ in support]
                    lengths=[sum(rig.data.bones[n].length for n in (f['upper'],f['lower']))*ev.matrix_world.to_scale().x for f,_,_,_ in support]
                    correction,residual=fit_support(hips,targets,lengths,margin=.96)
                    shift=Vector(correction);total+=shift
                    if residual>.002 or total.length>.12:raise ValueError(f'{code} frame {frame}: unreachable fixed feet')
                    if shift.length<.0001:break
                    pelvis=rig.pose.bones['CTRL_pelvis'];pelvis.location+=pelvis.bone.matrix_local.to_3x3().inverted()@rig.matrix_world.inverted().to_3x3()@shift
                    pelvis.keyframe_insert('location',frame=frame);rig.update_tag();bpy.context.view_layer.update()
                ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get());r=stats[code];r['max_support_correction_m']=max(r['max_support_correction_m'],total.length)
                for foot,q,planted,contact in support:
                    ankle=ev.matrix_world@ev.pose.bones[foot['lower']].tail;error=(ankle-q).length
                    r['max_ankle_target_error_m']=max(r['max_ankle_target_error_m'],error)
                    key=(code,foot['foot']);old=prior.get(key)
                    if planted and old and old[1] and (q-old[0]).length<1e-6:r['max_planted_slide_m']=max(r['max_planted_slide_m'],(ankle-old[2]).length)
                    prior[key]=(q,planted,ankle.copy())
                    if error>.004:raise ValueError(f'{code} frame {frame}: native ankle error {error}')
            if frame%240==0:print('V025_MOTION_FRAME',frame,flush=True)
    return {'characters':stats,'frames':scene.frame_end-scene.frame_start+1,'limb_lengths_preserved':True,'production_approved':False}


def main(source,registry_path,script_path,dest):
    if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New output required')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;scene.frame_set(1)
    registry=json.loads(registry_path.read_text());script=json.loads(script_path.read_text());rigs={a['code']:bpy.data.objects[registry['characters'][a['code']]['rig']] for a in script['characters']}
    report={'source_sha256':digest(source),'script_sha256':digest(script_path),'production_approved':False}
    report['motion']=refine_motion(scene,script,registry,rigs)
    with rig_only_evaluation(scene):
        report['performance']=apply_performance(scene,script,rigs);bake_bounded_gaze(scene,rigs)
    # A body/head reaction can move the hand after the original prop bake.
    # Re-evaluate held props against the amended rig using recorded landmarks.
    grip_path=source.with_suffix('.grip.json')
    if grip_path.exists() and script.get('interactions'):
        from animation_system.interactions import author_supported_interactions
        from animation_system.grip import bake_attachment
        recorded=json.loads(grip_path.read_text())
        contacts={r['id']:r for r in recorded['contact']}
        for event in script['interactions']:event['contact_landmark_local']=contacts[event['id']]['contact_landmark_local']
        with rig_only_evaluation(scene):
            report['contact']=author_supported_interactions(scene,script,rigs)
            for event,contact in zip(script['interactions'],report['contact']):
                if not contact['grasp_contact_pass']:raise ValueError('Final body motion invalidated grasp')
                proxy=bpy.data.objects['PROP_'+event['id']];proxy.hide_render=True
                star=bpy.data.objects['PROP_STAR_SHARD'];scarf=bpy.data.objects['PROP_FOLDED_SCARF']
                for frame in range(scene.frame_start,scene.frame_end+1):
                    scene.frame_set(frame);star.location=proxy.location;star.keyframe_insert('location',frame=frame)
                    scarf.location=proxy.location+Vector((0,0,-.022));scarf.keyframe_insert('location',frame=frame)
                report['attachment']=bake_attachment(scene,rigs[event['character']],event.get('hand','R'),[star,scarf],contact['grasp_frame'])
    report['forest']=finish_forest(scene,[-3,3,-4,3],count=420)
    report['cameras']=finish_cameras(scene,script['cameras'],script['duration'])
    scene.frame_set(1);scene['production_approved']=False;scene['status']='V025_REVIEW_CANDIDATE';scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
    dest.parent.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
    report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.finish.json'),report);print('V025_FINISH',json.dumps(report),flush=True)

if __name__=='__main__':main(*map(Path,sys.argv[sys.argv.index('--')+1:]))
