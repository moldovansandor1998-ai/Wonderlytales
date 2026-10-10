"""Repair studio-scene swing clearance while retaining authored stance anchors."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.motion import foot_at,foot_heading,root_at
from animation_system.spec import digest,atomic_json
source,registry,script_path,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
script=json.loads(script_path.read_text())
if not script.get('studio'):raise ValueError('This repair requires the flat diagnostic stage; use terrain-aware scene compilation elsewhere')
if source.resolve()==dest.resolve():raise ValueError('Immutable source required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
reg=json.loads(registry.read_text());scene=bpy.context.scene
report={'source_sha256':digest(source),'blender':bpy.app.version_string,'production_approved':False,
        'xy_anchors_changed':False,'frames':scene.frame_end,'max_height_change_m':{}}
for frame in range(scene.frame_start,scene.frame_end+1):
    scene.frame_set(frame);t=(frame-1)/24
    for actor in script['characters']:
        code=actor['code'];asset=reg['characters'][code];rig=bpy.data.objects[asset['rig']]
        ev=rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        for foot in asset['feet']:
            foot={**foot,'leg_length':sum(rig.data.bones[n].length for n in (foot['upper'],foot['lower']))}
            point=ev.matrix_world@ev.pose.bones[foot['control']].head
            q,planted,_=foot_at(actor,foot,t,asset['scale'])
            lift=max(0,q[2]-root_at(actor,t)[0][2]-foot['ankle'][2]*asset['scale'])
            height=(foot['ankle'][2]-foot['sole_z'])*asset['scale']+.003+lift
            if not planted:
                delta=abs(point.z-height);report['max_height_change_m'][code]=max(report['max_height_change_m'].get(code,0),delta)
                point.z=height
                control=rig.pose.bones[foot['control']]
                control.location=control.bone.matrix_local.inverted()@(rig.matrix_world.inverted()@point)
                control.keyframe_insert('location',frame=frame)
    if frame%240==0:print('CLEARANCE_FRAME',frame,flush=True)
scene['production_approved']=False;scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.clearance.json'),report)
