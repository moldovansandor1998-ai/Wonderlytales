"""Import user-supplied Tripo models as packed, reviewed environment candidates.

blender -b --python import_tripo_environment.py -- UPLOAD_DIRECTORY OUTPUT_DIRECTORY
Preserves original files; creates separate lower-density Blender assets.
"""
import bpy,json,sys,hashlib,shutil
from pathlib import Path
from mathutils import Vector
root,out=map(Path,sys.argv[sys.argv.index('--')+1:]);root=root.resolve();out=out.resolve();out.mkdir(parents=True,exist_ok=True)
records=[]
for filename,code,role in [('griffin mount 3d model.glb.txt','PROP_GRIFFIN_MOUNT','REVIEW_ONLY'),('fantasy tree temple 3d model.glb.txt','SET_TREE_TEMPLE','FANTASY_SET_CANDIDATE'),('wood log 3d model.glb.txt','PROP_FALLEN_LOG','FOREST_PROP_CANDIDATE'),('arbre 3d model.glb.txt','ENV_TREE_ARBRE','FOREST_TREE_CANDIDATE')]:
    source=root/filename;glb=out/(code+'.glb');shutil.copyfile(source,glb)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb))
    s=bpy.context.scene;objects=[o for o in s.objects if o.type=='MESH'];before=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    for o in objects:
        o.name=code;o['source_sha256']=hashlib.sha256(source.read_bytes()).hexdigest();o['asset_status']='IMPORTED_ENVIRONMENT_CANDIDATE'
        if len(o.data.polygons)>180000:
            bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Separate render candidate reduction','DECIMATE');mod.ratio=150000/len(o.data.polygons);mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
        for p in o.data.polygons:p.use_smooth=True
    after=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)
    points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box];lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(lo+hi)/2;span=max(hi-lo)
    s.world=bpy.data.worlds.new('Asset review world');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.32,.36,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    cd=bpy.data.cameras.new('Asset review camera');cam=bpy.data.objects.new('Asset review camera',cd);s.collection.objects.link(cam);cam.location=center+Vector((span*.9,-span*1.8,span*.55));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cd.type='ORTHO';cd.ortho_scale=span*1.55;s.camera=cam
    for name,pos,power,size in [('Key',(-1,-1,1.6),100,1.5),('Fill',(1,-.4,.6),50,1),('Rim',(0,1,1),80,1)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=span*size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=center+Vector(pos)*span;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
    s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=800;s.render.resolution_y=800;s.render.resolution_percentage=100
    s['asset_status']='IMPORTED_ENVIRONMENT_CANDIDATE';s['story_role']=role
    bpy.ops.file.pack_all();blend=out/(code+'_V001.blend');bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
    s.render.filepath=str(out/(code+'_review.png'));bpy.ops.render.render(write_still=True)
    records.append({'code':code,'original_name':filename,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_triangles':before,'candidate_triangles':after,'packed_blend':blend.name,'blend_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'role':role,'rendered':True,'production_approved':False})
    print(json.dumps(records[-1]),flush=True)
(out/'environment_import_QC.json').write_text(json.dumps(records,indent=2))
