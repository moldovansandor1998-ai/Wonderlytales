"""Small native Cycles proof, labelled diagnostic; not a final quality render."""
import bpy,sys
from pathlib import Path
src,dest,frame=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=str(Path(src).resolve()),use_scripts=False);s=bpy.context.scene;s.frame_set(int(frame));s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=8;s.cycles.max_bounces=4;s.cycles.use_denoising=True;s.render.resolution_x=640;s.render.resolution_y=360;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.filepath=str(Path(dest).resolve());s.render.use_sequencer=False;bpy.ops.render.render(write_still=True)
