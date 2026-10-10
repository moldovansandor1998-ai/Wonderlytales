"""Native Cycles front, oblique and profile proofs for the facial checkpoint."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
src,out=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=str(Path(src).resolve()),use_scripts=False);s=bpy.context.scene;r=bpy.data.objects['CHAR_MARK_BODY_DRAFT'];root=r.parent;root.location=(0,0,0)
for o in s.objects:
 if o.type in ('MESH','LIGHT'):o.hide_render=True
for o in bpy.data.collections['CHAR_MARK_MASTER_V021'].objects:
 if o.type=='MESH':o.hide_render=False
s.world=bpy.data.worlds.new('Facial QA neutral world');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.15,.18,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
s.frame_set(1);r.update_tag();bpy.context.view_layer.update();target=r.matrix_world@Vector((-.021,-.12,.78))
for offset,energy in [((-1.5,-2,2),250),((1.5,-1,1),180)]:
 bpy.ops.object.light_add(type='AREA',location=target+Vector(offset));l=bpy.context.object;l.data.energy=energy;l.data.size=2;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();s.camera=bpy.context.object;s.camera.data.lens=70;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=True;s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.use_sequencer=False
out=Path(out);out.mkdir(parents=True,exist_ok=True)
for form,jaw in [('X',0),('D',.6),('F',.3)]:
 for f in 'XABCDEFGH':r['viseme_'+f]=float(f==form)
 r['jaw_open']=jaw;r.update_tag();bpy.context.view_layer.update()
 for name,offset in [('front',(0,-.72,.035)),('oblique',(.45,-.56,.035)),('profile',(.72,-.07,.035))]:
  s.camera.location=target+Vector(offset);s.camera.rotation_euler=(target-s.camera.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(out/f'{name}_{form}.png');bpy.ops.render.render(write_still=True)
