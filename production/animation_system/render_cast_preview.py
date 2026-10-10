"""Low-resolution native CPU motion preview, explicitly not production render."""
import bpy, json, sys, subprocess, struct, zlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json
source,destination=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
scene=bpy.context.scene;destination.mkdir(parents=True,exist_ok=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4
scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
scene.render.resolution_x=768;scene.render.resolution_y=432;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.use_sequencer=False
scene.render.filepath=str((destination/'frame_').resolve());scene.render.use_persistent_data=True
def valid_png(path):
    data=path.read_bytes()
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):return False
    offset=8
    while offset+12<=len(data):
        size=struct.unpack('>I',data[offset:offset+4])[0];end=offset+12+size
        if end>len(data):return False
        if zlib.crc32(data[offset+4:offset+8+size])!=struct.unpack('>I',data[offset+8+size:end])[0]:return False
        if data[offset+4:offset+8]==b'IEND':return end==len(data)
        offset=end
    return False
for path in destination.glob('frame_*.png'):
    if not valid_png(path):path.unlink()
scene.render.use_overwrite=False
bpy.ops.render.render(animation=True)
movie=destination/'WonderlyTales_V024_all6_motion_20s.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-framerate','24','-start_number',str(scene.frame_start),
 '-i',str(destination/'frame_%04d.png'),'-vf',"drawtext=text='NATIVE MOTION REVIEW - CPU 4 SAMPLES - NOT APPROVED':x=12:y=12:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.7",
 '-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(movie)],check=True)
atomic_json(destination/'preview.json',{'source_sha256':digest(source),'blender':bpy.app.version_string,
 'frames':scene.frame_end-scene.frame_start+1,'fps':24,'width':768,'height':432,
 'render_device':'CPU','samples':4,'audio':False,'production_approved':False,'sha256':digest(movie)})
