"""Assemble a native scene from separately published, hash-verified libraries."""
import hashlib,json
from pathlib import Path
import bpy

def load_published(directory):
 directory=Path(directory);manifest=json.loads((directory/'library_manifest.json').read_text());index={a['id']:a for a in manifest['assets']}
 required=['TV_CHAR_MIRA','TV_CHAR_BRUNO','TV_CHAR_KIPP','TV_ENV_REZRAKPART','TV_LIGHT_BLUE_HOUR']
 for key in required:
  item=index[key];path=directory/item['file']
  if hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Published asset checksum mismatch: '+key)
 bpy.ops.wm.read_factory_settings(use_empty=True)
 for key in required:
  item=index[key]
  with bpy.data.libraries.load(str(directory/item['file']),link=False) as (src,dst):dst.collections=[item['collection']]
  bpy.context.scene.collection.children.link(dst.collections[0])
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.fps=24
 scene.world=bpy.data.worlds.new('TV_WORLD_blue_hour');scene.world.use_nodes=True;node=scene.world.node_tree.nodes['Background'];node.inputs['Color'].default_value=(.16,.23,.34,1);node.inputs['Strength'].default_value=.35;scene.view_settings.view_transform='AgX'
 scene['series']='TITOKVAROS';scene['production_approved']=False;scene['source']='verified separate native libraries'
 for code in ['MIRA','BRUNO','KIPP']:
  rig=bpy.data.objects.get('TV_CHAR_'+code+'_RIG')
  if not rig or rig.type!='ARMATURE':raise ValueError('Missing rig '+code)
  for name in ['root','torso','head','hand_ik.L','hand_ik.R','foot_ik.L','foot_ik.R']:
   if name not in rig.pose.bones:raise ValueError('Missing rig control '+name)
 bpy.context.view_layer.update()
 return index
