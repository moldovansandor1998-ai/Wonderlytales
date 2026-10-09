"""Reversible native oral geometry on a selected Tripo body candidate.
Geometry, source-atlas colours and skin weights are retained in the saved fork.
Artist controls are not a claim of approved pronunciation or phoneme alignment.
"""
import bpy,bmesh,math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

def smooth(x):x=max(0.,min(1.,x));return x*x*(3-2*x)
def author_face(scene,body,rig,code,profile):
 cx,zc,width,height=profile
 body.data.calc_loop_triangles();original=[v.co.copy() for v in body.data.vertices];faces=[t.vertices[:] for t in body.data.loop_triangles]
 uvs=[[Vector((*body.data.uv_layers.active.data[l].uv,0)) for l in t.loops] for t in body.data.loop_triangles]
 surface=BVHTree.FromPolygons(original,faces)
 def hit(x,z):
  p,_,i,_=surface.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
  if p is None:
   p,_,i,d=surface.find_nearest(Vector((x,cy,z)))
   if p is None or d>.020:raise ValueError(f'{code}: facial surface not found at {x},{z}')
  return p,i
 cy=hit(cx,zc)[0].y
 atlas=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
 pixels=np.empty(len(atlas.pixels),dtype=np.float32);atlas.pixels.foreach_get(pixels);pixels=pixels.reshape(atlas.size[1],atlas.size[0],4)
 def sample(x,z):
  p,i=hit(x,z);uv=barycentric_transform(p,*[original[v] for v in faces[i]],*uvs[i]);c=pixels[int(np.clip(uv.y,0,1)*(atlas.size[1]-1)),int(np.clip(uv.x,0,1)*(atlas.size[0]-1)),:3];return np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
 # Cutting before adding shapes retains the source UVs and the deform layers.
 bm=bmesh.new();bm.from_mesh(body.data)
 edges=[e for e in bm.edges if all(((v.co.x-cx)/(width*1.55))**2+((v.co.z-zc)/.020)**2<1 and v.co.y<cy+.018 for v in e.verts)]
 bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
 remove=[v for v in bm.verts if ((v.co.x-cx)/(width*1.02))**2+((v.co.z-zc)/.0030)**2<1 and v.co.y<cy+.015]
 removed=len(remove)
 if removed<5:raise ValueError(f'{code}: insufficient mouth aperture vertices ({removed})')
 bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 j=rig.data.edit_bones.new('jaw');j.head=(cx,cy+.055,zc+.028);j.tail=(cx,cy+.014,zc-.014);j.parent=rig.data.edit_bones['head'];bpy.ops.object.mode_set(mode='OBJECT')
 def weight(co):
  x,y,z=co;return smooth((zc+.012-z)/.025)*smooth((width*3.3-abs(x-cx))/(width*2.0))*smooth((z-(zc-.065))/.022)*smooth((cy+.065-y)/.040)
 hg=body.vertex_groups.get('head');jg=body.vertex_groups.new(name='jaw');affected=0
 for v in body.data.vertices:
  x,y,z=v.co;mask=smooth((width*3.5-abs(x-cx))/(width*1.4))*smooth((z-(zc-.07))/.018)*smooth(((zc+.043)-z)/.016)*smooth((cy+.065-y)/.03)
  w=weight(v.co)
  if mask>1e-6:
   old={g.group:g.weight for g in v.groups};total=sum(old.values());old_head=old.get(hg.index,0)
   for group,amount in old.items():body.vertex_groups[group].add([v.index],amount*(1-mask),'REPLACE')
   hg.add([v.index],old_head*(1-mask)+total*mask*(1-w),'REPLACE');jg.add([v.index],total*mask*w,'REPLACE');affected+=1
 def drive(target,path,prop,expression,index=None):
  fc=target.driver_add(path,index) if index is not None else target.driver_add(path);d=fc.driver;v=d.variables.new();v.name='c';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]';d.expression=expression
 for prop in ['mouth_open','mouth_round','smile','brow_raise']:rig[prop]=0.
 jaw=rig.pose.bones['jaw'];jaw.rotation_mode='XYZ';drive(jaw,'rotation_euler','mouth_open','max(0,min(1,c))*.14',0)
 def material(name,c):
  m=bpy.data.materials.new(code+' '+name);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65;return m
 skin=material('atlas matched lip skin',(.4,.2,.1));vc=skin.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='SourceSkin';skin.node_tree.links.new(vc.outputs['Color'],skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 dark=material('recessed oral cavity',(.018,.002,.004))
 def mesh_object(name,verts,polys,mat,weights=None):
  m=bpy.data.meshes.new(code+' '+name);m.from_pydata(verts,[],polys);m.materials.append(mat);o=bpy.data.objects.new(code+'_'+name,m);scene.collection.objects.link(o);o.parent=rig;o.matrix_parent_inverse=rig.matrix_world.inverted()@body.matrix_world;o.matrix_basis.identity()
  h=o.vertex_groups.new(name='head');j=o.vertex_groups.new(name='jaw')
  for v in m.vertices:
   w=weight(v.co) if weights is None else weights[v.index];h.add([v.index],1-w,'REPLACE');j.add([v.index],w,'REPLACE')
  mod=o.modifiers.new('Actual head and jaw skin','ARMATURE');mod.object=rig
  for p in m.polygons:p.use_smooth=True
  return o
 N=64;R=8;verts=[];polys=[];colors=[];weights=[]
 for k in range(R):
  f=k/(R-1);w=width+.014*f;h=.00035+.01365*f
  for j in range(N):
   a=j*2*math.pi/N;x=cx+w*math.cos(a);z=zc+h*math.sin(a);p,_=hit(x,z);verts.append((x,p.y-.0005-.0007*(1-f)*abs(math.sin(a)),z))
   native=sample(x,z);edge=sample(cx+math.copysign(width+.017,x-cx),zc+.003*math.sin(a));edge*=np.array([.94,.87,.86]);blend=smooth((f-.55)/.45);colors.append(tuple(edge*(1-blend)+native*blend)+(1.,));weights.append(smooth(.5-.5*math.sin(a))*(1-f)+weight(Vector(verts[-1]))*f)
 for k in range(R-1):
  for j in range(N):q=(j+1)%N;polys.append((k*N+j,(k+1)*N+j,(k+1)*N+q,k*N+q))
 lips=mesh_object('MOUTH_LIPS',verts,polys,skin,weights);col=lips.data.color_attributes.new(name='SourceSkin',type='FLOAT_COLOR',domain='CORNER')
 for loop in lips.data.loops:col.data[loop.index].color=colors[loop.vertex_index]
 lips.shape_key_add(name='Basis');rnd=lips.shape_key_add(name='Rounded');smile=lips.shape_key_add(name='Smile')
 for i,v in enumerate(rnd.data):
  f=(i//N)/(R-1);influence=(1-f)**2;v.co.x=cx+(v.co.x-cx)*(1-.26*influence);v.co.y-=.002*influence;v.co.z+=(v.co.z-zc)*.4*influence
 for v in smile.data:v.co.z+=.004*math.exp(-((abs(v.co.x-cx)-width*.9)/.016)**2-((v.co.z-zc)/.016)**2)
 drive(rnd,'value','mouth_round','max(0,min(1,c))');drive(smile,'value','smile','max(0,min(1,c))')
 # Recessed bowl closes the hole behind the lips. Upper and lower parts follow
 # the same weights as the skin; no flat overlay crosses the moving cheek.
 verts=[];polys=[]
 for k in range(7):
  f=k/6;w=(width+.007)*(1-.94*f);h=.020*(1-.94*f)
  for j in range(N):
   a=j*2*math.pi/N;x=cx+w*math.cos(a);z=zc-.005+h*math.sin(a);p,_=hit(x,z);verts.append((x,p.y+.004+.021*f,z))
 for k in range(6):
  for j in range(N):q=(j+1)%N;polys.append((k*N+j,(k+1)*N+j,(k+1)*N+q,k*N+q))
 polys.append(tuple(6*N+j for j in range(N)));mesh_object('MOUTH_CAVITY',verts,polys,dark)
 body.shape_key_add(name='Basis');brow=body.shape_key_add(name='SurpriseBrow');body_smile=body.shape_key_add(name='ListeningSmile')
 for i,v in enumerate(body.data.vertices):
  x,y,z=v.co;front=smooth((cy+.07-y)/.05);brow.data[i].co.z+=.004*math.exp(-((abs(x-cx)-width)/.03)**2-((z-(zc+.073))/.012)**2)*front
 for i,v in enumerate(body.data.vertices):
  x,y,z=v.co;front=smooth((cy+.07-y)/.04);body_smile.data[i].co.z+=.004*math.exp(-((abs(x-cx)-width*.9)/.016)**2-((z-zc)/.016)**2)*front
 drive(body_smile,'value','smile','max(0,min(1,c))')
 drive(brow,'value','brow_raise','max(0,min(1,c))')
 return {'character':code,'mouth_center_local':[cx,cy,zc],'jaw_affected_vertices':affected,'aperture_vertices_removed':removed,'lip_vertices':N*R,'native_jaw_bone':True,'recessed_mouth_cavity':True,'phoneme_alignment_verified':False,'eyelids_independent':False,'facial_approved':False}
