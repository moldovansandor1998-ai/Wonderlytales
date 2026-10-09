"""Place the six fixed 3D characters together for a native cast review."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
forest,assets,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(forest.resolve()));s=bpy.context.scene
if not s.get('path_grounding_adjusted'):
    bpy.data.objects['Winding forest path'].location.z-=.055
    s['path_grounding_adjusted']=True
for code,height,position in [('CHAR_LILI',.95,(-1.55,.9,.03)),('CHAR_MORZSI',1.8,(1.3,1.9,.03)),('CHAR_POTTY',1.15,(.4,.8,.03)),('CHAR_BOGYO',.8,(.9,-.15,.03)),('CHAR_ZIZI',1.3,(2.8,1.8,.03))]:
    with bpy.data.libraries.load(str((assets/(code+'_TRIPO_V003_BODY_CANDIDATE.blend')).resolve()),link=False) as (src,dst):dst.objects=src.objects
    loaded=[o for o in dst.objects if o];rig=next(o for o in loaded if o.type=='ARMATURE')
    def belongs(o):
        p=o
        while p:
            if p==rig:return True
            p=p.parent
        return o.type=='MESH' and any(m.type=='ARMATURE' and m.object==rig for m in o.modifiers)
    objects=[o for o in loaded if belongs(o)]
    for o in objects:s.collection.objects.link(o)
    rig.animation_data_clear()
    for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
    body=max((o for o in objects if o.type=='MESH'),key=lambda o:len(o.data.vertices));bpy.context.view_layer.update()
    points=[body.matrix_world@Vector(p) for p in body.bound_box];low=min(p.z for p in points);high=max(p.z for p in points)
    pivot=bpy.data.objects.new(code+'_CAST_PLACEMENT',None);s.collection.objects.link(pivot)
    for o in objects:
        if o.parent not in objects:
            matrix=o.matrix_world.copy();o.parent=pivot;o.matrix_world=matrix
    scale=height/(high-low);pivot.scale=(scale,)*3;pivot.location=(position[0],position[1],position[2]-low*scale)
s.camera.location=(4,-7,2.8);target=Vector((.55,1.3,1.0));s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.lens=40
s['asset_status']='NEW_SIX_CHARACTER_CAST_LOOKDEV';s['facial_ready']=False;s['episode_finished']=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str((out/'S1E1_SIX_CHARACTERS_V015_DRAFT.blend').resolve()),compress=True)
s.render.filepath=str((out/'S1E1_six_characters_review.png').resolve());bpy.ops.render.render(write_still=True)
(out/'cast_stage_QC.json').write_text(json.dumps({'characters':6,'source':'NEW_TRIPO_MODELS','rendered':True,'static_lookdev_only':True,'facial_ready':False,'episode_finished':False},indent=2))
