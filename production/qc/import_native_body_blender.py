import bpy,json,sys,os,argparse,hashlib
import numpy as np
from pathlib import Path
if '--' not in sys.argv: raise RuntimeError('Pass the native asset directory after --')
parser=argparse.ArgumentParser();parser.add_argument('directory');parser.add_argument('--input-version',default='V006');parser.add_argument('--output-version',default='V007');parser.add_argument('--characters',nargs='+',default=['CHAR_MARK','CHAR_LILI']);args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);root=Path(args.directory).resolve()
reports=[]
for code in args.characters:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 source=root/(code+'_'+args.input_version+'_BODY_DRAFT.glb')
 bpy.ops.import_scene.gltf(filepath=str(source))
 armatures=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 assert len(armatures)==1 and meshes
 armature=armatures[0]
 assert len(armature.data.bones)>10
 for m in meshes:
  assert any(x.type=='ARMATURE' for x in m.modifiers)
  m['asset_status']='DRAFT_BODY_RIG';m['facial_ready']=False;m['production_approved']=False
 bpy.context.scene['asset_status']='DRAFT_BODY_RIG'
 bpy.context.scene['production_approved']=False
 bpy.context.scene['facial_ready']=False
 bpy.context.scene['source_glb']=source.name
 bpy.ops.file.pack_all()
 out=root/(code+'_'+args.output_version+'_BLENDER_BODY_DRAFT.blend')
 bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
 os.sync()
 bpy.ops.wm.open_mainfile(filepath=str(out))
 armatures=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
 armature=armatures[0]
 def evaluated_vertices(frame):
  bpy.context.scene.frame_set(frame)
  deps=bpy.context.evaluated_depsgraph_get();obj=meshes[0].evaluated_get(deps);evaluated=obj.to_mesh();positions=np.empty(len(evaluated.vertices)*3,dtype=np.float32);evaluated.vertices.foreach_get('co',positions);obj.to_mesh_clear();return positions.reshape(-1,3)
 rest=evaluated_vertices(0);posed=evaluated_vertices(18);delta=np.linalg.norm(posed-rest,axis=1)
 assert delta.max()>.005
 reports.append({'character':code,'file':out.name,'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'reopened':True,'maximum_pose_displacement':float(delta.max()),'moving_vertices':int((delta>.001).sum()),'armatures':len(armatures),'bones':len(armature.data.bones),'meshes':len(meshes),'actions':len(bpy.data.actions),'images':len(bpy.data.images),'status':'DRAFT_BODY_RIG','facial_ready':False,'production_approved':False})
 print(json.dumps(reports[-1]),flush=True)
(root/(args.output_version+'_Blender_body_import_report.json')).write_text(json.dumps({'blender':bpy.app.version_string,'characters':reports},indent=2))

os.sync()
