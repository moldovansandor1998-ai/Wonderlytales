"""Export native scene geometry and evaluated animation for a draft GL review.
Camera cuts and animated emission remain in an exact per-frame sidecar.
This is a preview renderer, not the approved final lighting pipeline.
"""
import bpy,sys,json,hashlib,math
from pathlib import Path
from mathutils import Matrix
args=sys.argv[sys.argv.index('--')+1:];source=Path(args[0]).resolve();dest=Path(args[1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
if len(args)>2:s.frame_start=int(args[2]);s.frame_end=int(args[3])
# Curves and fonts must be native geometry in the GL review, including rails and credits.
for o in list(s.objects):
 if o.type in ['CURVE','FONT'] and not o.hide_render:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
recipes={}
for m in bpy.data.materials:
 if not m.node_tree:continue
 ramps=[n for n in m.node_tree.nodes if n.type=='VALTORGB']
 if ramps:recipes[m.name]={'baseColorFactor':list(ramps[0].color_ramp.elements[-1].color),'procedural_noise':True}
 if any(n.type=='VERTEX_COLOR' for n in m.node_tree.nodes):
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':n.inputs['Base Color'].default_value=(1,1,1,1)
bpy.ops.object.select_all(action='DESELECT')
selected=set()
for o in s.objects:
 if o.type=='MESH' and not o.hide_render:
  selected.add(o)
  for mod in o.modifiers:
   if mod.type=='ARMATURE' and mod.object:selected.add(mod.object)
  p=o.parent
  while p:selected.add(p);p=p.parent
for o in selected:o.select_set(True)
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
emissive_materials=[m for m in bpy.data.materials if m.node_tree and any(n.type=='BSDF_PRINCIPLED' and (n.inputs['Emission Strength'].default_value>0 or (m.node_tree.animation_data and m.node_tree.animation_data.action)) for n in m.node_tree.nodes)]
frames=[]
for f in range(s.frame_start,s.frame_end+1,2):
 s.frame_set(f);cam=s.camera;world=C@cam.matrix_world
 em={}
 for m in emissive_materials:
  for n in m.node_tree.nodes:
   if n.type=='BSDF_PRINCIPLED':
    strength=n.inputs['Emission Strength'].default_value
    if strength>0:em[m.name]=[float(v)*strength for v in n.inputs['Emission Color'].default_value[:3]]
 frames.append({'source_frame':f,'camera_matrix':[list(r) for r in world],'yfov':2*math.atan(cam.data.sensor_width/s.render.resolution_x*s.render.resolution_y/(2*cam.data.lens)),'emission':em})
 if len(frames)%1200==0:print('SIDECAR_FRAMES',len(frames),flush=True)
s.frame_set(s.frame_start)
dest.with_suffix('.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'source_start':s.frame_start,'source_end':s.frame_end,'native_fps':12,'delivery_fps':24,'frames':frames,'materials':recipes,'lighting_approved':False,'full_episode_finished':False}))
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=True,export_skins=True,export_apply=False,export_cameras=False,export_current_frame=False,export_frame_range=True,export_animation_mode='SCENE',export_force_sampling=True,export_frame_step=2,export_anim_slide_to_zero=True,export_optimize_animation_size=True)
print('NATIVE_REVIEW_EXPORTED',dest,flush=True)
