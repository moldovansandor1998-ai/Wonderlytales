"""Assemble a portable review stage from the new forest and new Mark candidate.

blender -b --python build_tripo_forest_stage.py -- FOREST_BLEND MARK_BLEND OUTPUT
This is one look-development frame, not an authored episode scene.
"""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
forest,character,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(forest.resolve()));s=bpy.context.scene
with bpy.data.libraries.load(str(character.resolve()),link=False) as (src,dst):
    dst.objects=[n for n in src.objects]
loaded=[o for o in dst.objects if o]
rig=next(o for o in loaded if o.type=='ARMATURE')
def belongs(o):
    p=o
    while p:
        if p==rig:return True
        p=p.parent
    return o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)
objects=[o for o in loaded if belongs(o)]
for o in objects:s.collection.objects.link(o)
body=max((o for o in objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
rig.animation_data_clear();s.frame_set(0)
for bone in rig.pose.bones:bone.rotation_mode='XYZ';bone.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
points=[body.matrix_world@Vector(c) for c in body.bound_box];low=min(v.z for v in points);high=max(v.z for v in points)
pivot=bpy.data.objects.new('CHAR_MARK_stage_placement',None);s.collection.objects.link(pivot)
for o in objects:
    if o.parent not in objects:
        matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
scale=1.6/(high-low);pivot.scale=(scale,)*3;pivot.location=(-.4,1,.07-low*scale)
s.camera.location=(3,-5,2.1);target=Vector((-.1,2,1.3));s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=42
s['asset_status']='MARK_FOREST_STAGE_LOOKDEV_DRAFT';s['animation_complete']=False;s['episode_finished']=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str((out/'S1E1_MARK_FOREST_STAGE_V014_DRAFT.blend').resolve()),compress=True)
s.render.filepath=str((out/'S1E1_Mark_forest_review.png').resolve());bpy.ops.render.render(write_still=True)
(out/'stage_QC.json').write_text(json.dumps({'status':'LOOKDEV_REVIEW_STAGE','character_height_m':1.6,'character':'CHAR_MARK','body_rig':True,'facial_ready':False,'episode_finished':False},indent=2))
