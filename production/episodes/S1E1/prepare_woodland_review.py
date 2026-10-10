"""Keep the native woodland shader in GL reviews with an albedo bake.
Also consolidates static branch geometry; never bakes lighting into characters.
Blender --python ... -- SOURCE DEST
"""
import bpy,sys
from pathlib import Path
source,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
floor=bpy.data.objects['V018 continuous woodland terrain']
uv=floor.data.uv_layers.new(name='WoodlandAlbedoUV')
for loop in floor.data.loops:
 v=floor.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=((v.x+30)/60,(v.y+12)/72)
mat=floor.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes['Principled BSDF'];out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
image=bpy.data.images.new('V018 native woodland albedo',width=2048,height=2048);image.colorspace_settings.name='sRGB'
tex=nodes.new('ShaderNodeTexImage');tex.image=image;nodes.active=tex
em=nodes.new('ShaderNodeEmission');links.new(bs.inputs['Base Color'].links[0].from_socket,em.inputs['Color']);links.new(em.outputs[0],out.inputs['Surface'])
bpy.ops.object.select_all(action='DESELECT');floor.select_set(True);bpy.context.view_layer.objects.active=floor
s.render.engine='CYCLES';s.cycles.samples=4;s.render.bake.use_selected_to_active=False
bpy.ops.object.bake(type='EMIT');links.new(bs.outputs[0],out.inputs['Surface']);links.new(tex.outputs['Color'],bs.inputs['Base Color']);nodes.remove(em)
image.pack()
static=[o for o in s.objects if o.type=='MESH' and (o.name.startswith('V018 layered woodland trunk') or o.name.startswith('V018 crown branch'))]
bpy.ops.object.select_all(action='DESELECT')
for o in static:o.select_set(True)
if static:
 bpy.context.view_layer.objects.active=static[0];bpy.ops.object.join();bpy.context.object.name='V018 combined woodland bark'
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
print('WOODLAND_REVIEW_PREPARED',dest,flush=True)
