"""Apply the checked woodland assets to existing native story scenes.
Blender --python ... -- ROOT SOURCE DEST
"""
import bpy,bmesh,sys,math
from pathlib import Path
from mathutils import Vector,Matrix
root,source,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
for o in list(s.objects):
 if o.name in ['Uneven forest floor','Winding forest path'] or o.name.startswith('Distant wooded hill'):o.hide_render=True
 if o.type=='MESH' and o.name.startswith('Reusable forest foliage'):
  o.data=o.data.copy();bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.delete(bm,geom=[v for v in bm.verts if (o.matrix_world@v.co).z<.7],context='VERTS');bm.to_mesh(o.data);bm.free()
with bpy.data.libraries.load(str(root/'episode-v018/S1E1_SC001_REVIEW_V018.blend'),link=False) as (a,b):
 b.objects=[n for n in a.objects if n.startswith('V018 ') and 'focus' not in n]
for o in b.objects:
 if o:s.collection.objects.link(o)
for name in ['Forest gate light opening','Garden return opening']:
 if name not in bpy.data.objects:continue
 o=bpy.data.objects[name]
 bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=8,major_radius=1,minor_radius=.017)
 torus=bpy.context.object;data=torus.data.copy();data.transform(Matrix.Rotation(math.pi/2,4,'X'));data.materials.clear()
 for m in o.data.materials:data.materials.append(m)
 o.data=data;bpy.data.objects.remove(torus,do_unlink=True)
 # An open luminous rim shows the characters through the portal.
 if o.animation_data and o.animation_data.action:
  for fc in o.animation_data.action.fcurves:
   if fc.data_path=='scale' and fc.array_index==1:
    for k in fc.keyframe_points:
     if k.co.y>.01:k.co.y=1;k.handle_left.y=1;k.handle_right.y=1
sun=bpy.data.objects.get('Late afternoon sun')
if sun:sun.data.energy=3;sun.data.color=(1,.84,.65);sun.data.angle=.13
fill=bpy.data.objects.get('Soft camera fill')
if fill:fill.data.energy=350;fill.data.color=(.78,.88,1);fill.data.size=6
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.31,.46,.63,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.3
if s.frame_start>3600:
 for name,pos,target,power,col in [('Garden warm key',(39,2,7),(41,5,0),900,(1,.84,.65)),('Garden sky fill',(46,3,6),(42,6,.5),450,(.70,.83,1))]:
  d=bpy.data.lights.new('V018 '+name,'AREA');d.energy=power;d.color=col;d.size=7;o=bpy.data.objects.new('V018 '+name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
s.view_settings.exposure=.35;s['look_stage']='V018_CHECKED_WOODLAND_AND_OPEN_PORTAL_RIM';s['full_episode_finished']=False
bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
print('LOOK_ADOPTED',dest,flush=True)
