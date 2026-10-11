"""Local diagnostic renderer. Every output is an actual authored 3D frame.
Low-resolution output is explicitly labelled as blocking, never final quality.
"""
import bpy,sys,argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--blend',required=True);p.add_argument('--out',required=True);p.add_argument('--start',type=int,default=1);p.add_argument('--end',type=int,default=96);p.add_argument('--width',type=int,default=640);p.add_argument('--samples',type=int,default=8);p.add_argument('--stills',default='');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(Path(a.blend).resolve()),use_scripts=False);s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=a.samples;s.cycles.use_denoising=True;s.render.use_persistent_data=True;s.render.use_sequencer=False
s.render.resolution_x=a.width;s.render.resolution_y=round(a.width*9/16);s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.fps=24
out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
frames=[int(x) for x in a.stills.split(',')] if a.stills else range(a.start,a.end+1)
for f in frames:
 path=out/f'frame_{f:06}.png'
 if path.exists():continue
 s.frame_set(f)
 for o in s.objects:
  if o.type=='ARMATURE':o.update_tag(refresh={'OBJECT'})
 bpy.context.view_layer.update();s.render.filepath=str(path);bpy.ops.render.render(write_still=True)
 print('TV_FRAME_READY '+str(f),flush=True)
