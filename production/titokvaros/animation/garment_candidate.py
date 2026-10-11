"""Structural garment experiment: continuous shoulder surface, not a re-render.
Preserves the existing master and exports an unapproved separate candidate.
"""
import argparse,sys,json,hashlib
from pathlib import Path
import bpy
from mathutils import Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_native import weighted,active
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(Path(a.source).resolve()),use_scripts=False);report=[]
for code in ['MIRA','BRUNO']:
 rig=bpy.data.objects['TV_CHAR_'+code+'_RIG'];parts=[bpy.data.objects[code+'_COAT']]+[bpy.data.objects[code+'_ARM_SKIN_'+s] for s in ['L','R']];material=parts[0].data.materials[0]
 for o in parts:
  for mod in o.modifiers:
   if mod.type=='ARMATURE':mod.show_viewport=False
 bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();verts=[];faces=[]
 for obj in parts:
  evaluated=obj.evaluated_get(deps);m=evaluated.to_mesh();base=len(verts);local=Matrix.LocRotScale(obj.location,obj.rotation_euler,obj.scale)
  verts.extend([local@v.co for v in m.vertices]);faces.extend([tuple(base+i for i in face.vertices) for face in m.polygons]);evaluated.to_mesh_clear()
 mesh=bpy.data.meshes.new(code+'_garment_continuous');mesh.from_pydata(verts,[],faces);mesh.materials.append(material);mesh.update();obj=bpy.data.objects.new(code+'_GARMENT_CONTINUOUS',mesh);bpy.context.collection.objects.link(obj);active(obj)
 remesh=obj.modifiers.new('Structural shoulder union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.008;remesh.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=remesh.name)
 smooth=obj.modifiers.new('Surface relaxation','SMOOTH');smooth.factor=.8;smooth.iterations=5;bpy.ops.object.modifier_apply(modifier=smooth.name)
 dec=obj.modifiers.new('Development reduction','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
 for face in obj.data.polygons:face.use_smooth=True
 bones=['DEF-spine','DEF-spine.001','DEF-spine.002','DEF-spine.003','DEF-spine.004','DEF-shoulder.L','DEF-shoulder.R']+[f'DEF-{part}.{side}{suffix}' for side in ['L','R'] for part in ['upper_arm','forearm'] for suffix in ['', '.001']]
 weighted(obj,rig,bones);obj.modifiers.get('Rigify deformation').use_deform_preserve_volume=True
 # The two-nearest-bone rule creates a discontinuity across a continuous shoulder.
 # Blend four nearby same-side anatomy bones, including the scapular chain.
 all_indices=list(range(len(obj.data.vertices)))
 for group in obj.vertex_groups:group.remove(all_indices)
 for vertex in obj.data.vertices:
  co=vertex.co;distances=[]
  for name in bones:
   if (name.endswith('.L') or '.L.' in name) and co.x<-.04:continue
   if (name.endswith('.R') or '.R.' in name) and co.x>.04:continue
   bone=rig.data.bones[name];delta=bone.tail_local-bone.head_local;t=max(0,min(1,(co-bone.head_local).dot(delta)/max(delta.length_squared,1e-8)));distance=max(.02,(co-bone.head_local-delta*t).length);distances.append((distance,name))
  distances.sort();near=distances[:4];weights=[distance**-3 for distance,name in near];total=sum(weights)
  for (distance,name),weight in zip(near,weights):obj.vertex_groups[name].add([vertex.index],weight/total,'REPLACE')
 for old in parts:old.hide_render=True;old.hide_set(True)
 report.append({'character':code,'mesh':obj.name,'vertices':len(obj.data.vertices),'production_approved':False,'change':'Coat and both sleeves share one continuous remeshed surface; weights recomputed in rest space.'})
bpy.ops.wm.save_as_mainfile(filepath=str(out/'TV_GARMENT_CANDIDATE_V001.blend'));(out/'garment_audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
