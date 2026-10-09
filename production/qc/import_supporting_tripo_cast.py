"""Import, reduce and review new Tripo body-rig prototypes in Blender.

The facial rigs and contact animation remain explicit production gates.
"""
import bpy,sys,json,hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
cli=sys.argv[sys.argv.index('--')+1:];root=Path(cli[0]).resolve()
characters=cli[1:] or ['CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_BOGYO','CHAR_ZIZI']
report_path=root/'supporting_cast_QC.json'
reports=json.loads(report_path.read_text()) if report_path.exists() else []
reports=[r for r in reports if r['character'] not in characters]
for code in characters:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source=root/(code+'_TRIPO_V002_BODY_DRAFT.glb')
    bpy.ops.import_scene.gltf(filepath=str(source))
    s=bpy.context.scene;s.frame_set(0)
    body=max((o for o in s.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
    rig=next(o for o in s.objects if o.type=='ARMATURE')
    before=sum(len(p.vertices)-2 for p in body.data.polygons)
    bpy.context.view_layer.objects.active=body;body.select_set(True)
    mod=body.modifiers.new('Separate animation candidate reduction','DECIMATE');mod.ratio=150000/before;mod.use_collapse_triangulate=True
    body.modifiers.move(len(body.modifiers)-1,0);bpy.ops.object.modifier_apply(modifier=mod.name)
    def coords(frame):
        s.frame_set(frame);ob=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ob.to_mesh()
        a=np.empty(len(me.vertices)*3,np.float32);me.vertices.foreach_get('co',a);ob.to_mesh_clear();return a.reshape(-1,3)
    delta=np.linalg.norm(coords(18)-coords(0),axis=1)
    assert delta.max()>.005 and body.data.uv_layers and len(rig.data.bones)>10
    s.frame_set(0);body.name=code+'_TRIPO_BODY_CANDIDATE';rig.name=code+'_TRIPO_BODY_RIG'
    s.world=bpy.data.worlds.new('Review world');s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.25,.29,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
    cd=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new('Review camera',cd);s.collection.objects.link(cam)
    cam.location=(1,-3,1);target=Vector((0,0,.5));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=1.45;s.camera=cam
    for name,pos,power,size in [('Key',(-2,-3,4),250,3),('Fill',(2,-1,2),90,2),('Rim',(0,2,3),180,2)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=720;s.render.resolution_y=720;s.render.resolution_percentage=100
    s['facial_ready']=False;s['production_approved']=False;s['asset_status']='SIMPLIFIED_BODY_RIG_CANDIDATE'
    bpy.ops.file.pack_all();blend=root/(code+'_TRIPO_V003_BODY_CANDIDATE.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(blend));s=bpy.context.scene
    body=bpy.data.objects[code+'_TRIPO_BODY_CANDIDATE'];rig=bpy.data.objects[code+'_TRIPO_BODY_RIG']
    for frame,label in [(0,'rest'),(18,'pose')]:
        s.frame_set(frame);s.render.filepath=str(root/(code+'_'+label+'_review.png'));bpy.ops.render.render(write_still=True)
    reports.append({'character':code,'file':blend.name,'sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_triangles':before,'candidate_triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'bones':len(rig.data.bones),'maximum_pose_displacement':float(delta.max()),'moving_vertices':int((delta>.001).sum()),'reopened':True,'rest_and_pose_rendered':True,'facial_ready':False,'production_approved':False})
    (root/'supporting_cast_QC.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports[-1]),flush=True)
