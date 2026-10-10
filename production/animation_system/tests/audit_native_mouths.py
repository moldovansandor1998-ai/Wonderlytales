"""Attribute native outer-mouth failures to actors over a chosen frame range."""
import bpy,sys,json,hashlib
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from animation_system.quality import MouthQuality

source,registry,output,start,end=sys.argv[sys.argv.index('--')+1:];source=Path(source);reg=json.loads(Path(registry).read_text());bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);compiled=json.loads(source.with_suffix('.compiled.json').read_text());checks={}
for code in compiled['cast']:
 patch=bpy.data.objects[code+'_FACIAL_TOPOLOGY'];body=bpy.data.objects[reg['characters'][code]['body']];checks[code]=(patch,bpy.data.objects[reg['characters'][code]['rig']],MouthQuality([patch,body],reg))
for frame in range(int(start),int(end)+1):
 bpy.context.scene.frame_set(frame);dep=bpy.context.evaluated_depsgraph_get()
 for code,(patch,rig,quality) in checks.items():
  evaluated=patch.evaluated_get(dep);mesh=evaluated.to_mesh()
  try:quality.sample(patch,np.array([v.co[:] for v in mesh.vertices]),rig.evaluated_get(dep))
  finally:evaluated.to_mesh_clear()
fields=['sampled_mesh_frames','nonfinite','max_outer_edge_stretch_ratio','flipped_outer_triangles','invalid_viseme_frames','rest_folded_front_triangles','outer_geometry_pass']
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'frame_range':[int(start),int(end)],'characters':{code:{key:q.result()[key] for key in fields} for code,(_,_,q) in checks.items()},'professional_quality_approved':False,'limitation':'Outer-mouth attribution only; full scene seam measurements remain in the render QC reports.'}
Path(output).write_text(json.dumps(report,indent=2)+'\n');print('NATIVE_MOUTH_ATTRIBUTION',json.dumps(report['characters']))
