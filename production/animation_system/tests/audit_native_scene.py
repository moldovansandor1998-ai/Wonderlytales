import bpy,sys,json,math,os,hashlib
from pathlib import Path
src,registry,out=map(Path,sys.argv[sys.argv.index('--')+1:sys.argv.index('--')+4]);chunk=int(sys.argv[sys.argv.index('--')+4]);bpy.ops.wm.open_mainfile(filepath=str(src.resolve()),use_scripts=False);reg=json.loads(registry.read_text());compiled=json.loads(src.with_suffix('.compiled.json').read_text());s=bpy.context.scene;result={'version':reg.get('version','V021'),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'professional_quality_approved':False,'sampled_jaw_drivers':[],'render_boundary_checks':[]};jawpass=True
mouth_frames=sorted({a['frame'] for a in compiled.get('mouth_states',[])})
frames={1,compiled['frames']//2,compiled['frames']}
if mouth_frames:frames.update(mouth_frames[::max(1,len(mouth_frames)//10)])
for f in sorted(frames):
 s.frame_set(f);dep=bpy.context.evaluated_depsgraph_get()
 for c in compiled['cast']:
  r=bpy.data.objects[reg['characters'][c]['rig']];e=r.evaluated_get(dep);measured=float(e.pose.bones['jaw'].rotation_euler.x);expected=max(0,min(1,float(r['jaw_open'])))*.12;passed=abs(measured-expected)<1e-5;jawpass=jawpass and passed;result['sampled_jaw_drivers'].append({'frame':f,'character':c,'jaw_angle_rad':measured,'expected_rad':expected,'pass':passed})
for f in range(chunk,compiled['frames'],chunk):
 rotations={}
 s.frame_set(f);dep=bpy.context.evaluated_depsgraph_get()
 for c in compiled['cast']:
  r=bpy.data.objects[reg['characters'][c]['rig']].evaluated_get(dep)
  for name in ['head','spine']+[name for foot in reg['characters'][c]['feet'] for name in (foot['upper'],foot['lower'])]:rotations[(c,name)]=r.matrix_world.to_quaternion()@r.pose.bones[name].matrix.to_quaternion()
 s.frame_set(f+1);dep=bpy.context.evaluated_depsgraph_get();maximum=0;abrupt=[]
 for (c,name),old in rotations.items():
  r=bpy.data.objects[reg['characters'][c]['rig']].evaluated_get(dep);new=r.matrix_world.to_quaternion()@r.pose.bones[name].matrix.to_quaternion();angle=new.rotation_difference(old).angle;speed=math.degrees(min(angle,math.tau-angle))*24;maximum=max(maximum,speed)
  if speed>600:abrupt.append({'character':c,'joint':name,'deg_s':speed})
 result['render_boundary_checks'].append({'frames':[f,f+1],'max_joint_velocity_deg_s':maximum,'abrupt_joints':abrupt,'pass':not abrupt})
result['sampled_jaw_drivers_pass']=jawpass;result['render_boundaries_pass']=all(a['pass'] for a in result['render_boundary_checks'])
with out.open('w') as file:json.dump(result,file,indent=2);file.flush();os.fsync(file.fileno())
print('NATIVE_SCENE_TIMING',jawpass,result['render_boundaries_pass'],flush=True)
if not jawpass:raise RuntimeError('Compiled scene jaw drivers failed')
