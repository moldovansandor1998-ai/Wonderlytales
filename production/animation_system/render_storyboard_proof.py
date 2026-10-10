"""Render each authored shot midpoint with the production Blender version.

Small Cycles frames are staging evidence, not final quality approval.
"""
import bpy,json,sys
from pathlib import Path
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);out.mkdir(parents=True,exist_ok=True)
script=json.loads(source.with_suffix('.script.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=8;s.cycles.max_bounces=4;s.cycles.use_denoising=True
s.render.resolution_x=480;s.render.resolution_y=270;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.use_sequencer=False
for i,shot in enumerate(script['cameras']):
    end=script['cameras'][i+1]['start'] if i+1<len(script['cameras']) else script['duration']
    frame=round((shot['start']+end)/2*24)+1;s.frame_set(min(s.frame_end,frame))
    s.render.filepath=str((out/f'{source.stem}_shot_{i+1:02}.png').resolve())
    bpy.ops.render.render(write_still=True)
    print('SHOT_PROOF',i+1,frame,flush=True)
