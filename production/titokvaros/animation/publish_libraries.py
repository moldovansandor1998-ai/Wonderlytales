"""Publish versioned, editable native development libraries without approval.
A distinct file per character/set/prop avoids exporting the whole film for reuse.
No archived asset is imported. All outputs are immutable by checksum on upload.
"""
import argparse,json,hashlib,sys
from pathlib import Path
import bpy

def descend(o):
 result={o}
 for c in o.children:result.update(descend(c))
 return result

def write_collection(name,objects,out,report,role):
 c=bpy.data.collections.new(name)
 for o in objects:c.objects.link(o)
 c['series']='TITOKVAROS';c['stage']='DEVELOPMENT';c['production_approved']=False;c['asset_role']=role
 c.asset_mark();c.asset_data.description='Original Titokváros development asset. NOT production-approved.'
 path=out/(name+'_V001.blend');bpy.data.libraries.write(str(path),{c},path_remap='RELATIVE',fake_user=True,compress=True)
 report.append({'id':name,'file':path.name,'role':role,'collection':name,'objects':len(objects),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bytes':path.stat().st_size,'production_approved':False})
 return c

def main():
 p=argparse.ArgumentParser();p.add_argument('--master',required=True);p.add_argument('--animated',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(exist_ok=True,parents=True);report=[]
 bpy.ops.wm.open_mainfile(filepath=str(Path(a.master).resolve()),use_scripts=False);heroes=set()
 for code in ['MIRA','BRUNO','KIPP']:
  rig=bpy.data.objects['TV_CHAR_'+code+'_RIG'];rig.location=(0,0,0);objects=descend(rig);heroes.update(objects)
  write_collection('TV_CHAR_'+code,objects,out,report,'character')
 env={o for o in bpy.context.scene.objects if o not in heroes and not o.hide_render and o.type in {'MESH','CURVE','FONT'} and not o.name.startswith('WGT-')}
 write_collection('TV_ENV_REZRAKPART',env,out,report,'environment')
 lighting={o for o in bpy.context.scene.objects if o.type=='LIGHT'};write_collection('TV_LIGHT_BLUE_HOUR',lighting,out,report,'lighting')
 bpy.ops.wm.open_mainfile(filepath=str(Path(a.animated).resolve()),use_scripts=False);bpy.context.scene.frame_set(1)
 for name,root,role in [('TV_PROP_CARGO_TROLLEY','TV_PROP_cargo_trolley','prop'),('TV_VEHICLE_TRAM','TV_VEHICLE_tram','vehicle')]:
  obj=bpy.data.objects[root];obj.animation_data_clear();obj.location=(0,0,0)
  for child in descend(obj):child.animation_data_clear()
  write_collection(name,descend(obj),out,report,role)
 cams={o for o in bpy.context.scene.objects if o.name.startswith('TV_CAM_SH')};write_collection('TV_CAM_DEMO_TEMPLATES',cams,out,report,'camera_templates')
 extras={o for i in range(6) for o in descend(bpy.data.objects[f'TV_EXTRA_{i:02d}'])};write_collection('TV_EXTRAS_RESIDENTS',extras,out,report,'background_characters')
 # Reload every saved library in a fresh empty scene. Dependencies must be real.
 for item in report:
  bpy.ops.wm.read_factory_settings(use_empty=True)
  with bpy.data.libraries.load(str(out/item['file']),link=False) as (src,dst):
   if item['collection'] not in src.collections:raise RuntimeError('Missing published collection')
   dst.collections=[item['collection']]
  col=dst.collections[0];bpy.context.scene.collection.children.link(col);bpy.context.view_layer.update()
  if len(col.objects)!=item['objects']:raise RuntimeError('Published object count differs')
  for o in col.objects:
   for mod in o.modifiers:
    if mod.type=='ARMATURE' and (not mod.object or mod.object.type!='ARMATURE'):raise RuntimeError('Missing deformation rig dependency')
  item['reload_verified']=True
 (out/'library_manifest.json').write_text(json.dumps({'series':'TITOKVAROS','production_approved':False,'assets':report},indent=2)+'\n');print(json.dumps({'libraries':len(report),'reload_verified':all(x['reload_verified'] for x in report)}))
if __name__=='__main__':main()
