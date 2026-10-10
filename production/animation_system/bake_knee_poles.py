"""Keep native knee poles away from the hip-to-ankle singular line."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json
source,registry,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
if source.resolve()==dest.resolve():raise ValueError('Immutable source required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
reg=json.loads(registry.read_text());scene=bpy.context.scene
assets={c:a for c,a in reg['characters'].items() if bpy.data.objects.get(a['rig'])}
report={'source_sha256':digest(source),'blender':bpy.app.version_string,'production_approved':False,
        'frames':scene.frame_end,'method':'project anatomical bend direction perpendicular to hip-ankle axis',
        'fallback_frames':[]}
for frame in range(scene.frame_start,scene.frame_end+1):
    scene.frame_set(frame)
    for code,asset in assets.items():
        rig=bpy.data.objects[asset['rig']];ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        root=bpy.data.objects[asset['root']];root_rotation=root.matrix_world.to_quaternion()
        for foot in asset['feet']:
            hip=ev.matrix_world@ev.pose.bones[foot['upper']].head
            ankle=ev.matrix_world@ev.pose.bones[foot['control']].head
            axis=(ankle-hip).normalized()
            direction=root_rotation@Vector((0,1 if foot['foot'].startswith('hind') else -1,0))
            direction-=axis*direction.dot(axis)
            if direction.length<.1:
                direction=root_rotation@Vector((1,0,0));direction-=axis*direction.dot(axis)
                report['fallback_frames'].append({'frame':frame,'character':code,'foot':foot['foot']})
            pole=(hip+ankle)*.5+direction.normalized()*max(.25,(ankle-hip).length)
            bone=rig.pose.bones[foot['pole']]
            bone.location=bone.bone.matrix_local.inverted()@(rig.matrix_world.inverted()@pole)
            bone.keyframe_insert('location',frame=frame)
    if frame%240==0:print('KNEE_FRAME',frame,flush=True)
scene['production_approved']=False;scene['status']='V024_KNEE_POLE_CANDIDATE';scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.poles.json'),report)
