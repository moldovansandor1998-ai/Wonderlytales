"""Stream actual Blender-evaluated geometry into the review renderer, with QC.
Lighting is deliberately labeled a preview. Native Cycles renders remain the
visual reference. Native IK targets and meshes are measured, not inferred from
pose-control values.
"""
import bpy,sys,json,struct,subprocess,os,math
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import atomic_json,digest
from animation_system.quality import MouthQuality
from mathutils import Vector

def send(pipe,data):
 if not isinstance(data,bytes):data=json.dumps(data).encode()
 pipe.write(struct.pack('<Q',len(data)));pipe.write(data);pipe.flush()

def main(src,registry_path,output,python,start=1,end=None):
 bpy.ops.wm.open_mainfile(filepath=str(src),use_scripts=False);s=bpy.context.scene;reg=json.loads(registry_path.read_text());compiled=json.loads(src.with_suffix('.compiled.json').read_text());s.frame_set(1);dep=bpy.context.evaluated_depsgraph_get();objects=[o for o in s.objects if o.type=='MESH' and not o.hide_render];cache=output.parent/(output.stem+'_textures');cache.mkdir(exist_ok=True);config={'width':640,'height':360,'frames':s.frame_end,'output':str(output),'meshes':[]};statics=[];indices=[];rest_edges={};measurements={'master_sha256':compiled['master_sha256'],'scene_sha256':digest(src),'frames':s.frame_end,'engine':'BLENDER_EVALUATED_GEOMETRY_GL_PREVIEW','professional_quality_approved':False,'max_ankle_target_error_m':0.,'max_planted_ankle_slide_m':0.,'max_body_edge_stretch_ratio':1.,'nonfinite_vertices':0,'mesh_topology_changes':0,'foot_error_frames':[]};prior={};contacts={}
 for c in compiled['contacts']:contacts.setdefault(c['frame'],[]).append(c)
 for oi,o in enumerate(objects):
  ev=o.evaluated_get(dep);m=ev.to_mesh();m.calc_loop_triangles();tri=np.array([t.loops[:] for t in m.loop_triangles],dtype='i4').ravel();vi=np.array([m.loops[i].vertex_index for i in tri],dtype='i4');indices.append(vi);uv=np.zeros((len(vi),2),dtype='f4');colors=np.ones((len(vi),4),dtype='f4')
  if m.uv_layers.active:uv=np.array([m.uv_layers.active.data[i].uv[:] for i in tri],dtype='f4')
  color=m.color_attributes.get('MasterSkin')
  if color:colors=np.array([color.data[i].color[:] for i in tri],dtype='f4');colors[:,:3]=np.where(colors[:,:3]<=.0031308,colors[:,:3]*12.92,1.055*np.maximum(colors[:,:3],0)**(1/2.4)-.055)
  material=o.data.materials[0] if o.data.materials else None;base=[.6,.6,.6,1];texture=None
  if material:
   base=list(material.diffuse_color)
   if material.use_nodes:
    bs=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bs:base=list(bs.inputs['Base Color'].default_value)
    im=next((n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB'),None)
    if im:
     texture=str(cache/f'{oi}.png');temporary=str(cache/f'{oi}.tmp.png');im.filepath_raw=temporary;im.file_format='PNG';im.save()
     with open(temporary,'rb') as file:os.fsync(file.fileno())
     os.replace(temporary,texture);base=[1,1,1,1]
  config['meshes'].append({'name':o.name,'texture':texture,'base':base});statics.append(np.concatenate((uv,colors),axis=1).astype('<f4').tobytes());ev.to_mesh_clear()
  if any(o.name==a['body'] for a in reg['characters'].values()):
   edges=np.array([e.vertices[:] for e in o.data.edges],dtype='i4');verts=np.array([v.co[:] for v in o.data.vertices]);length=np.linalg.norm(verts[edges[:,0]]-verts[edges[:,1]],axis=1);mask=length>1e-4;rest_edges[o.name]=(edges[mask],length[mask])
 end=s.frame_end if end is None else int(end);start=int(start)
 if not 1<=start<=end<=s.frame_end:raise ValueError('Invalid review frame range')
 config['frames']=end-start+1;measurements['frames']=config['frames'];measurements['frame_start']=start;measurements['frame_end']=end
 mouth_qc=MouthQuality(objects,reg);prior_bones={};measurements['max_sampled_joint_angular_velocity_deg_s']=0.;measurements['abrupt_joint_frames']=[];foot_samples={};surface_points={};prior_surface={};measurements['max_planted_sole_point_slide_m']=0.;measurements['minimum_planted_sole_height_m']=1e9;measurements['maximum_planted_sole_height_m']=-1e9
 for c in compiled['cast']:
  spec=reg['characters'][c];body=bpy.data.objects[spec['body']]
  for foot in spec['feet']:
   group=body.vertex_groups.get(foot['foot']);candidates=[v for v in body.data.vertices if group and any(g.group==group.index and g.weight>.7 for g in v.groups)]
   if candidates:foot_samples[(c,foot['foot'])]=(body.name,[min(candidates,key=lambda v:v.co.y).index,max(candidates,key=lambda v:v.co.y).index,min(candidates,key=lambda v:v.co.z).index])
 worker=subprocess.Popen([str(python),str(Path(__file__).with_name('review_server.py'))],stdin=subprocess.PIPE,stdout=subprocess.PIPE);send(worker.stdin,config)
 for data in statics:send(worker.stdin,data)
 if worker.stdout.readline()!=b'READY\n':raise RuntimeError('Review renderer initialization failed')
 measurements['sole_sensor_feet']=len(foot_samples)
 for f in range(start,end+1):
  s.frame_set(f);dep=bpy.context.evaluated_depsgraph_get();mouth_qc.sample_seams(dep);cam=s.camera.evaluated_get(dep);proj=cam.calc_matrix_camera(dep,x=640,y=360,scale_x=1,scale_y=1);vp=proj@cam.matrix_world.inverted();send(worker.stdin,{'vp':[list(r) for r in vp],'models':[[list(row) for row in o.matrix_world] for o in objects]})
  for o,vi in zip(objects,indices):
   ev=o.evaluated_get(dep);m=ev.to_mesh();p=np.empty(len(m.vertices)*3,dtype='f4');n=np.empty_like(p);m.vertices.foreach_get('co',p);m.vertices.foreach_get('normal',n);p=p.reshape(-1,3);n=n.reshape(-1,3)
   measurements['nonfinite_vertices']+=int(np.count_nonzero(~np.isfinite(p)))
   if o.name in mouth_qc.items:mouth_qc.sample(o,p,o.parent.evaluated_get(dep))
   for key,(body_name,sensors) in foot_samples.items():
    if body_name==o.name:
     matrix=np.array([list(row) for row in o.matrix_world]);surface_points[key]=p[sensors]@matrix[:3,:3].T+matrix[:3,3]
   if len(p)<=vi.max():raise ValueError('Mesh topology changed during render')
   send(worker.stdin,np.concatenate((p[vi],n[vi]),axis=1).astype('<f4').tobytes())
   if o.name in rest_edges:
    edges,length=rest_edges[o.name];ratio=np.linalg.norm(p[edges[:,0]]-p[edges[:,1]],axis=1)/length;measurements['max_body_edge_stretch_ratio']=max(measurements['max_body_edge_stretch_ratio'],float(np.max(ratio)))
   ev.to_mesh_clear()
  for c in compiled['cast']:
   r=bpy.data.objects[reg['characters'][c]['rig']].evaluated_get(dep)
   names=['head','spine','upper_arm.L','upper_arm.R','forearm.L','forearm.R']+[name for foot in reg['characters'][c]['feet'] for name in (foot['upper'],foot['lower'])]
   for name in names:
    if name not in r.pose.bones:continue
    rotation=r.matrix_world.to_quaternion()@r.pose.bones[name].matrix.to_quaternion();key=(c,name);old=prior_bones.get(key)
    if old:
     angle=rotation.rotation_difference(old).angle;speed=math.degrees(min(angle,math.tau-angle))*24;measurements['max_sampled_joint_angular_velocity_deg_s']=max(measurements['max_sampled_joint_angular_velocity_deg_s'],speed)
     if speed>600 and len(measurements['abrupt_joint_frames'])<100:measurements['abrupt_joint_frames'].append({'frame':f,'character':c,'joint':name,'deg_s':speed})
    prior_bones[key]=rotation.copy()
  for contact in contacts.get(f,[]):
   spec=reg['characters'][contact['character']];r=bpy.data.objects[spec['rig']].evaluated_get(dep);foot=next(x for x in spec['feet'] if x['foot']==contact['foot']);q=r.matrix_world@r.pose.bones[foot['foot']].head;error=(q-Vector(contact['target'])).length;measurements['max_ankle_target_error_m']=max(measurements['max_ankle_target_error_m'],error)
   if error>.015 and len(measurements['foot_error_frames'])<100:measurements['foot_error_frames'].append({'frame':f,'character':contact['character'],'foot':contact['foot'],'error':error})
   key=(contact['character'],contact['foot']);prev=prior.get(key)
   if contact['planted'] and prev and prev[0] and prev[1]==contact['contact']:measurements['max_planted_ankle_slide_m']=max(measurements['max_planted_ankle_slide_m'],(q-prev[2]).length)
   prior[key]=(contact['planted'],contact['contact'],q.copy())
   if key in surface_points:
    samples=surface_points[key];old=prior_surface.get(key)
    if contact['planted']:
     ground=contact['target'][2]-(foot['ankle'][2]-foot['sole_z'])*spec['scale']-.003;height=float(samples[:,2].min()-ground);measurements['minimum_planted_sole_height_m']=min(measurements['minimum_planted_sole_height_m'],height);measurements['maximum_planted_sole_height_m']=max(measurements['maximum_planted_sole_height_m'],height)
     if old and old[0] and old[1]==contact['contact']:measurements['max_planted_sole_point_slide_m']=max(measurements['max_planted_sole_point_slide_m'],float(np.linalg.norm(samples-old[2],axis=1).max()))
    prior_surface[key]=(contact['planted'],contact['contact'],samples.copy())
  if worker.stdout.readline()!=b'FRAME\n':raise RuntimeError('Review renderer failed during frame')
  if f%120==0:print('NATIVE_REVIEW',f,s.frame_end,flush=True)
 worker.stdin.close();code=worker.wait()
 if code:raise RuntimeError('Review renderer exited with error')
 measurements['mouth_geometry']=mouth_qc.result()
 measurements['structural_qc_pass']=measurements['nonfinite_vertices']==0 and measurements['max_ankle_target_error_m']<=.015 and measurements['max_planted_ankle_slide_m']<=.015 and measurements['max_body_edge_stretch_ratio']<=5 and measurements['mouth_geometry']['pass'] and measurements['sole_sensor_feet']==sum(len(reg['characters'][c]['feet']) for c in compiled['cast']) and not measurements['abrupt_joint_frames'] and measurements['max_planted_sole_point_slide_m']<=.015 and measurements['minimum_planted_sole_height_m']>=-.015 and measurements['maximum_planted_sole_height_m']<=.025
 measurements['limitations']=['Lighting is review shading, not the final native Cycles image','Edge and bone checks cannot certify acting quality or mouth surface intersections','Multi-camera artist review required'];atomic_json(output.with_suffix('.qc.json'),measurements)
 print('REVIEW_FINISHED',measurements,flush=True)
if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:];main(*[Path(x).resolve() for x in args[:4]],*[int(x) for x in args[4:]])
