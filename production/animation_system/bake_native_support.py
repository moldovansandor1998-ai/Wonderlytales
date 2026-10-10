"""All-frame support bake with a bend reserve and evaluated rejection checks.

Foot targets, limb lengths and meshes are never changed. Source stays immutable.
The bake is an authoring candidate; a complete independent QA pass is required.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.support import fit_support
from animation_system.spec import digest, atomic_json


def sample(rig, asset):
    ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
    hips=[];targets=[];lengths=[];errors=[]
    for foot in asset['feet']:
        hip=ev.matrix_world@ev.pose.bones[foot['upper']].head
        target=ev.matrix_world@ev.pose.bones[foot['control']].head
        ankle=ev.matrix_world@ev.pose.bones[foot['lower']].tail
        hips.append(list(hip));targets.append(list(target))
        lengths.append(sum(ev.data.bones[n].length for n in (foot['upper'],foot['lower']))*ev.matrix_world.to_scale().x)
        errors.append((ankle-target).length)
    reach=max((Vector(t)-Vector(h)).length/l for h,t,l in zip(hips,targets,lengths))
    return hips,targets,lengths,max(errors),reach


def main(source,registry,destination):
    if source.resolve()==destination.resolve():raise ValueError('Immutable source required')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
    scene=bpy.context.scene;reg=json.loads(registry.read_text())
    assets={c:a for c,a in reg['characters'].items() if bpy.data.objects.get(a['rig'])}
    report={'source_sha256':digest(source),'blender':bpy.app.version_string,
            'margin':.96,'frames':scene.frame_end-scene.frame_start+1,
            'production_approved':False,'characters':{c:{'corrections':[],'rejected':[]} for c in assets}}
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame)
        for code,asset in assets.items():
            rig=bpy.data.objects[asset['rig']];pelvis=rig.pose.bones['CTRL_pelvis']
            hips,targets,lengths,error,reach=sample(rig,asset)
            if error<.003 and reach<=.962:continue
            original=pelvis.location.copy();total=Vector((0,0,0));reason=None
            for _ in range(3):
                shift,residual=fit_support(hips,targets,lengths,margin=.96)
                shift=Vector(shift);total+=shift
                if residual>.002 or total.length>.12:
                    reason='infeasible_or_large';break
                local=rig.matrix_world.inverted().to_3x3()@shift
                pelvis.location+=pelvis.bone.matrix_local.to_3x3().inverted()@local
                rig.update_tag();bpy.context.view_layer.update()
                hips,targets,lengths,after,after_reach=sample(rig,asset)
                if after<=.004 and after_reach<=.968:break
            if reason or after>.004 or after_reach>.975:
                pelvis.location=original;rig.update_tag();bpy.context.view_layer.update()
                report['characters'][code]['rejected'].append({'frame':frame,'reason':reason or 'evaluated_reach','before_error':error})
                continue
            pelvis.keyframe_insert('location',frame=frame)
            report['characters'][code]['corrections'].append({'frame':frame,'world_shift':list(total),'before_error':error,'after_error':after,'before_reach':reach,'after_reach':after_reach})
        if frame%240==0:print('SUPPORT_FRAME',frame,flush=True)
    scene['production_approved']=False;scene['status']='V024_ALL_FRAME_SUPPORT_CANDIDATE';scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()),compress=True)
    report['candidate_sha256']=digest(destination);atomic_json(destination.with_suffix('.support.json'),report)
    print('SUPPORT_RESULT',{c:{'corrected':len(a['corrections']),'rejected':len(a['rejected'])} for c,a in report['characters'].items()},flush=True)


if __name__=='__main__':main(*map(Path,sys.argv[sys.argv.index('--')+1:]))
