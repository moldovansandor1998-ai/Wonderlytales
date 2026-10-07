import bpy,json,sys,os
from pathlib import Path
if '--' not in sys.argv: raise RuntimeError('Pass the native asset directory after --')
root=Path(sys.argv[sys.argv.index('--')+1]).resolve()
reports=[]
for code in ['CHAR_MARK','CHAR_LILI']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 source=root/(code+'_V006_BODY_DRAFT.glb')
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
 out=root/(code+'_V007_BLENDER_BODY_DRAFT.blend')
 bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
 os.sync()
 reports.append({'character':code,'file':out.name,'bytes':out.stat().st_size,'armatures':len(armatures),'bones':len(armature.data.bones),'meshes':len(meshes),'actions':len(bpy.data.actions),'images':len(bpy.data.images),'status':'DRAFT_BODY_RIG','facial_ready':False,'production_approved':False})
 print(json.dumps(reports[-1]),flush=True)
(root/'V007_Blender_body_import_report.json').write_text(json.dumps({'blender':bpy.app.version_string,'characters':reports},indent=2))

os.sync()
