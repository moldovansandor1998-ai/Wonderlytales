"""Refresh evaluated cameras in existing clips after a camera-only native edit.
Geometry-source hashes are preserved; camera provenance is recorded separately.
"""
import bpy,sys,json,math,hashlib
from pathlib import Path
from mathutils import Matrix
args=sys.argv[sys.argv.index('--')+1:];root=Path(args[0]).resolve();source=root/'episode-v017/S1E1_SC004_019_STORY_BLOCKING_V017.blend';bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene;sha=hashlib.sha256(source.read_bytes()).hexdigest();C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
for name in args[1:]:
 p=root/'episode-v017'/f'{name}_review.json';m=json.loads(p.read_text())
 for i,f in enumerate(m['frames']):
  s.frame_set(f['source_frame']);cam=s.camera;f['camera_matrix']=[list(row) for row in C@cam.matrix_world];f['yfov']=2*math.atan(cam.data.sensor_width/s.render.resolution_x*s.render.resolution_y/(2*cam.data.lens))
  if i%600==0:print('CAMERA_REFRESH',name,i,flush=True)
 m['camera_source_sha256']=sha;m['camera_update_only']=True;p.write_text(json.dumps(m));print('CAMERA_REFRESH_COMPLETE',name,len(m['frames']),flush=True)
