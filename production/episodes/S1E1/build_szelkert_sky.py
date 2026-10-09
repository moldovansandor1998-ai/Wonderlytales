"""Author a native cloud setting around the imported floating temple candidate."""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
source,out=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()));s=bpy.context.scene
body=max((o for o in s.objects if o.type=='MESH'),key=lambda o:len(o.data.vertices))
points=[body.matrix_world@Vector(p) for p in body.bound_box]
lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=(lo+hi)/2;span=max(hi-lo)
world=s.world;nodes=world.node_tree.nodes;links=world.node_tree.links;nodes.clear()
output=nodes.new('ShaderNodeOutputWorld');bg=nodes.new('ShaderNodeBackground');bg.inputs['Strength'].default_value=.65
tex=nodes.new('ShaderNodeTexCoord');sep=nodes.new('ShaderNodeSeparateXYZ');ramp=nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].position=0;ramp.color_ramp.elements[0].color=(.16,.46,.85,1)
ramp.color_ramp.elements[1].position=.8;ramp.color_ramp.elements[1].color=(.025,.16,.42,1)
links.new(tex.outputs['Normal'],sep.inputs[0]);links.new(sep.outputs['Z'],ramp.inputs[0]);links.new(ramp.outputs['Color'],bg.inputs['Color']);links.new(bg.outputs[0],output.inputs[0])
mat=bpy.data.materials.new('Cloud ivory');mat.diffuse_color=(.95,.98,1,1);mat.use_nodes=True
shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.93,.97,1,1);shader.inputs['Roughness'].default_value=.9
right=s.camera.rotation_euler.to_matrix()@Vector((1,0,0));up=s.camera.rotation_euler.to_matrix()@Vector((0,1,0));back=(center-s.camera.location).normalized()
for cloud,(x,y) in enumerate([(-.72,-.34),(.83,-.30),(-.93,.24),(.87,.39),(-.38,-.59),(.45,-.56)]):
    base=center+right*x*span+up*y*span+back*span*.9
    for lump,(dx,dz,rad) in enumerate([(-.15,0,.18),(0,.06,.24),(.20,.02,.16),(.33,-.015,.12)]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=rad*span,location=base+right*dx*span+up*dz*span)
        o=bpy.context.object;o.name=f'Cloud_{cloud:02}_{lump:02}';o.scale=(1.35,1,.64);o.data.materials.append(mat)
        for p in o.data.polygons:p.use_smooth=True
s.camera.data.ortho_scale*=.85;s.cycles.samples=32
s['asset_status']='SZELKERT_SKY_LOOKDEV_DRAFT';s['bridges_and_bells_authored']=False;s['episode_finished']=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out.resolve()),compress=True)
s.render.filepath=str(out.with_suffix('.png').resolve());bpy.ops.render.render(write_still=True)
