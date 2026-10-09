"""Place reviewed user assets in separate native forest and Szélkert stages."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
forest,assets,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
def append_model(path,name,height,position):
    with bpy.data.libraries.load(str(path.resolve()),link=False) as (src,dst):
        dst.objects=[n for n in src.objects]
    meshes=[o for o in dst.objects if o and o.type=='MESH']
    for o in meshes:
        matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix;bpy.context.scene.collection.objects.link(o)
    points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)));hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    scale=height/(hi.z-lo.z);center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    parent=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(parent)
    for o in meshes:
        o.location-=center;o.parent=parent
    parent.scale=(scale,)*3;parent.location=position
    return parent
bpy.ops.wm.open_mainfile(filepath=str(forest.resolve()));s=bpy.context.scene
if not s.get('path_grounding_adjusted'):
    bpy.data.objects['Winding forest path'].location.z-=.055
    s['path_grounding_adjusted']=True
append_model(assets/'PROP_FALLEN_LOG_V001.blend','Fallen log beside trail',1.1,(1.7,2,.02))
s['asset_status']='FOREST_WITH_UPLOADED_PROP_LOOKDEV';s['episode_finished']=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str((out/'S1E1_FOREST_UPLOADED_PROP_V015_DRAFT.blend').resolve()),compress=True)
s.render.filepath=str((out/'S1E1_forest_log_review.png').resolve());bpy.ops.render.render(write_still=True)
bpy.ops.wm.open_mainfile(filepath=str((assets/'SET_TREE_TEMPLE_V001.blend').resolve()));s=bpy.context.scene
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.68,.85,1)
s.render.resolution_x=1280;s.render.resolution_y=720;s.camera.data.ortho_scale*=1.9
s['asset_status']='SZELKERT_IMPORTED_TEMPLE_LOOKDEV';s['episode_finished']=False
# This candidate is a floating island establishing view; authored bridges,
# three bells and character interaction have not yet been added.
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str((out/'S1E1_SZELKERT_TEMPLE_V015_DRAFT.blend').resolve()),compress=True)
s.render.filepath=str((out/'S1E1_Szelkert_review.png').resolve());bpy.ops.render.render(write_still=True)
(out/'environment_stage_QC.json').write_text(json.dumps({'forest_prop_integrated':True,'floating_temple_stage_created':True,'magic_tree_role':'REVIEW_ONLY_FACE_SCULPTURE_DO_NOT_ADD_AS_SPEAKING_CHARACTER','griffin_role':'RESERVED_NOT_FIRST_EPISODE_CAST','bridges_and_bell_mechanism_authored':False,'episode_finished':False},indent=2))
