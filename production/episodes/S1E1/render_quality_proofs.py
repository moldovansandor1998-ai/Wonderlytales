"""Native Cycles stills for visual review of the quality-test source."""
import bpy, sys, json, hashlib
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]);out=root/'episode-v018'
bpy.ops.wm.open_mainfile(filepath=str(out/'CSODAKAPU_60S_NATIVE_V018.blend'),use_scripts=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.use_sequencer=False;s.render.use_persistent_data=True
s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGB';files=[]
for frame in [33,390,965,1250]:
 s.frame_set(frame);dest=out/f'QUALITY_TEST_native_proof_{frame:04}.png';s.render.filepath=str(dest);bpy.ops.render.render(write_still=True)
 files.append({'frame':frame,'path':dest.name,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()});print('NATIVE_PROOF_COMPLETE',frame,flush=True)
(out/'native_proofs_QC_V018.json').write_text(json.dumps({'proofs':files,'samples':16,'width':1280,'height':720,'renderer':'BLENDER_CYCLES_CPU','production_approved':False},indent=2))
