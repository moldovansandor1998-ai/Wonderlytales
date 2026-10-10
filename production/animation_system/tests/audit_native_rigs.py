import bpy,sys,json,os,hashlib
from pathlib import Path
src,registry,out=map(Path,sys.argv[sys.argv.index('--')+1:]);bpy.ops.wm.open_mainfile(filepath=str(src.resolve()),use_scripts=False);reg=json.loads(registry.read_text());result={'version':reg.get('version','V021'),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'professional_quality_approved':False,'characters':{}}
for code,a in reg['characters'].items():
 r=bpy.data.objects[a['rig']];face=bpy.data.objects[code+'_FACIAL_TOPOLOGY'];missing=[n for n in a['controls'] if n not in r.pose.bones];actions=[n for n in a['actions'] if n in bpy.data.actions and bpy.data.actions[n].asset_data is not None];iks=[any(c.type=='IK' and c.chain_count==2 and c.target==r and not c.use_stretch for c in r.pose.bones[f['lower']].constraints) for f in a['feet']]
 r['jaw_open']=1;r['gaze_yaw.L']=.2;r['gaze_yaw.R']=0;r['blink.L']=1;r['blink.R']=0;r['viseme_X']=0;r['viseme_A']=1;r.update_tag();bpy.context.view_layer.update();dep=bpy.context.evaluated_depsgraph_get();e=r.evaluated_get(dep)
 measured={'jaw_angle':float(e.pose.bones['jaw'].rotation_euler.x),'eye_L_yaw':float(e.pose.bones['eye.L'].rotation_euler.z),'eye_R_yaw':float(e.pose.bones['eye.R'].rotation_euler.z),'blink_L':float(bpy.data.objects[code+'_EYELID.L'].data.shape_keys.key_blocks['blink'].value),'blink_R':float(bpy.data.objects[code+'_EYELID.R'].data.shape_keys.key_blocks['blink'].value),'viseme_A':float(face.data.shape_keys.key_blocks['viseme_A'].value)}
 driven=abs(measured['jaw_angle']-.12)<1e-5 and abs(measured['eye_L_yaw']-.2)<1e-5 and abs(measured['eye_R_yaw'])<1e-5 and measured['blink_L']==1 and measured['blink_R']==0 and measured['viseme_A']==1
 result['characters'][code]={'anatomy':a['anatomy'],'control_count':len(a['controls']),'missing_controls':missing,'action_asset_count':len(actions),'foot_ik_count':len(iks),'all_foot_ik_valid':all(iks),'driver_measurements':measured,'independent_facial_drivers_pass':driven,'native_rig_structure_pass':not missing and len(actions)==13 and all(iks) and driven,'mouth_boundary_matched':bool(face.get('boundary_matched')),'natural_motion_approved':False}
result['all_structure_checks_pass']=all(a['native_rig_structure_pass'] for a in result['characters'].values())
with out.open('w') as f:json.dump(result,f,indent=2);f.flush();os.fsync(f.fileno())
print(json.dumps(result),flush=True)
if not result['all_structure_checks_pass']:raise RuntimeError('Native rig structure or independent facial drivers failed')
