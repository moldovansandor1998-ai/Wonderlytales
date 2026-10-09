"""Render the exact new Mark body rig, preserving source mesh and textures.

blender -b --python render_tripo_mark_review.py -- RIG_BLEND OUTPUT_DIRECTORY
"""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
s.render.resolution_x=480;s.render.resolution_y=640;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Mark review world');s.world.use_nodes=True
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.32,.36,1)
s.world.node_tree.nodes['Background'].inputs[1].default_value=.4
camdata=bpy.data.cameras.new('Mark review camera');cam=bpy.data.objects.new('Mark review camera',camdata);s.collection.objects.link(cam)
cam.location=(.5,-1.7,.62);target=Vector((0,0,.50));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
camdata.type='ORTHO';camdata.ortho_scale=1.15;s.camera=cam
for name,power,pos,size in [('Key',75,(-.7,-.8,1.3),1),('Fill',35,(.8,-.4,.8),.8),('Rim',65,(0,.6,1.1),.7)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.size=size
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
for frame,name in [(0,'Mark_rest_review.png'),(18,'Mark_body_pose_review.png')]:
    s.frame_set(frame);s.render.filepath=str((out/name).resolve());bpy.ops.render.render(write_still=True)
print('TRIPO_MARK_PBR_REVIEW_RENDERED',flush=True)
