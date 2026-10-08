"""Render real animated frames; no still-image zoom or replacement identity."""
import bpy,sys,json,time
from pathlib import Path
blend,out,start,end= sys.argv[sys.argv.index('--')+1:]
out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(blend).resolve()))
s=bpy.context.scene
s.render.engine='CYCLES';s.cycles.samples=4;s.cycles.use_denoising=True
s.cycles.max_bounces=4;s.cycles.diffuse_bounces=2;s.cycles.glossy_bounces=2
s.cycles.transmission_bounces=2;s.cycles.volume_bounces=0
s.render.use_persistent_data=True
# Draft animation on twos: 12 authored motion phases/s exposed in a 24fps file.
# This is explicitly recorded in the QC report, not a final 24-phase render.
for f in range(int(start),int(end)+1,2):
 s.frame_set(f);s.render.filepath=str(out/f'frame_{f:04d}.png')
 p=Path(s.render.filepath)
 if p.exists() and p.read_bytes().endswith(b'IEND\xaeB\x60\x82'):continue
 bpy.ops.render.render(write_still=True)
 if f%24==1:print('OPENING_RENDER_PROGRESS',f,s.frame_end,flush=True)
