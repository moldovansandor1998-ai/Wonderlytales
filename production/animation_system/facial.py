"""Native retopologized oral/eyelid surfaces and independent eye/jaw bones.

The old oral overlay and its body-jaw weights are discarded by the master
builder. New concentric quad loops connect a stable cheek boundary to the lip
aperture. Speech and expressions use named shape keys on this new topology.
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
from .spec import FACE_PROFILES, VISEMES, smooth

FORMS={ # width, upper aperture, lower aperture, protrusion, jaw angle
 'X':(1.,.0003,.0003,0.,0.), 'A':(.95,.00012,.00012,.0005,0.),
 'B':(1.07,.0010,.0016,0.,.025), 'C':(1.04,.0025,.0032,0.,.055),
 'D':(.96,.0040,.0050,0.,.10), 'E':(.74,.0030,.0035,.002,.065),
 'F':(.56,.0018,.0022,.0035,.04), 'G':(.94,.00065,.0012,.0004,.018),
 'H':(1.03,.0020,.0030,0.,.048),
}

def driver(target,path,rig,prop,expression='c',index=None):
 fc=target.driver_add(path,index) if index is not None else target.driver_add(path)
 d=fc.driver;d.type='SCRIPTED'
 for old in list(d.variables):d.variables.remove(old)
 v=d.variables.new();v.name='c';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]';d.expression=expression

def material(name,color,rough=.6,vertex_colors=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
 if vertex_colors:
  n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='MasterSkin';m.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
 return m

class Surface:
 def __init__(self,body):
  body.data.calc_loop_triangles();self.v=[v.co.copy() for v in body.data.vertices];self.tri=[t.vertices[:] for t in body.data.loop_triangles]
  self.uv=[[Vector((*body.data.uv_layers.active.data[l].uv,0)) for l in t.loops] for t in body.data.loop_triangles]
  self.tree=BVHTree.FromPolygons(self.v,self.tri)
  self.binding=[{body.vertex_groups[g.group].name:g.weight for g in v.groups} for v in body.data.vertices]
  layer=body.data.color_attributes.get('MasterSkin')
  self.vertex_colors=[[np.array(layer.data[l].color[:3]) for l in t.loops] for t in body.data.loop_triangles] if layer and layer.domain=='CORNER' else None
  self.pixels=None
  if self.vertex_colors is None:
   im=next(n.image for m in body.data.materials if m and m.node_tree for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
   pixels=np.empty(len(im.pixels),dtype=np.float32);im.pixels.foreach_get(pixels);self.pixels=pixels.reshape(im.size[1],im.size[0],4)
 def hit(self,x,z,reference=None):
  p,_,idx,_=self.tree.ray_cast(Vector((x,-3,z)),Vector((0,1,0)))
  if p is None or (reference is not None and p.y>reference+.025):
   p,_,idx,_=self.tree.find_nearest(Vector((x,reference if reference is not None else -.14,z)))
  if p is None:raise ValueError('Facial landmark misses source surface')
  return p,idx
 def color(self,x,z,reference=None):
  p,i=self.hit(x,z,reference)
  if self.vertex_colors is not None:
   weights=barycentric_transform(p,*[self.v[k] for k in self.tri[i]],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
   return sum(c*weight for c,weight in zip(self.vertex_colors[i],weights))
  uv=barycentric_transform(p,*[self.v[k] for k in self.tri[i]],*self.uv[i]);h,w=self.pixels.shape[:2];rgb=self.pixels[int(np.clip(uv.y,0,1)*(h-1)),int(np.clip(uv.x,0,1)*(w-1)),:3]
  return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 def weights(self,x,z,reference):
  p,i=self.hit(x,z,reference);b=barycentric_transform(p,*[self.v[k] for k in self.tri[i]],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)));result={}
  for idx,w in zip(self.tri[i],b):
   for name,value in self.binding[idx].items():result[name]=result.get(name,0)+max(0,w)*value
  total=sum(result.values());return {k:v/total for k,v in result.items()} if total else {'head':1.}

def native_mesh(scene,rig,body,name,vertices,faces,mat,weights=None,colors=None):
 data=bpy.data.meshes.new(name);data.from_pydata(vertices,[],faces);data.materials.append(mat)
 obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.parent=rig;obj.matrix_parent_inverse=rig.matrix_world.inverted()@body.matrix_world;obj.matrix_basis.identity()
 groups={}
 for i in range(len(vertices)):
  for bone,w in (weights[i] if weights is not None else {'head':1.}).items():
   if w<=0:continue
   if bone not in groups:groups[bone]=obj.vertex_groups.new(name=bone)
   groups[bone].add([i],w,'REPLACE')
 mod=obj.modifiers.new('Master facial skin','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True
 if colors is not None:
  layer=data.color_attributes.new(name='MasterSkin',type='FLOAT_COLOR',domain='CORNER')
  for loop in data.loops:layer.data[loop.index].color=(*colors[loop.vertex_index],1)
 for poly in data.polygons:poly.use_smooth=True
 return obj

def ring_faces(n,r):
 return [(k*n+j,(k+1)*n+j,(k+1)*n+(j+1)%n,k*n+(j+1)%n) for k in range(r-1) for j in range(n)]

def cut_surface(body,regions):
 """Remove old baked surface faces, never push them behind a face overlay."""
 bm=bmesh.new();bm.from_mesh(body.data);remove=[]
 for f in bm.faces:
  p=f.calc_center_median()
  if any(any(((q.co.x-x)/w)**2+((q.co.z-z)/h)**2<1 and q.co.y<y+.07 for q in f.verts) for x,y,z,w,h in regions):remove.append(f)
 count=len(remove);bmesh.ops.delete(bm,geom=remove,context='FACES_ONLY')
 x,y,z,w,h=regions[0];edges=[e for e in bm.edges if e.is_boundary and all(((v.co.x-x)/w)**2+((v.co.z-z)/h)**2<9 and v.co.y<y+.075 for v in e.verts)];remaining=set(edges);loops=[]
 while remaining:
  edge=remaining.pop();start=edge.verts[0];v=edge.verts[1];loop=[start];visited={edge}
  while v!=start and len(loop)<1000:
   loop.append(v);next_edges=[e for e in v.link_edges if e in remaining and e in edges]
   if not next_edges:break
   edge=next_edges[0];remaining.remove(edge);visited.add(edge);v=edge.other_vert(v)
  if v==start and len(loop)>12:loops.append([p.co.copy() for p in loop])
 loops=[loop for loop in loops if min(p.x for p in loop)<x<max(p.x for p in loop) and min(p.z for p in loop)<z<max(p.z for p in loop)]
 boundary=min(loops,key=lambda loop:sum(((p.x-x)/w)**2+((p.z-z)/h)**2 for p in loop)/len(loop)) if loops else []
 if boundary:
  boundary.sort(key=lambda p:math.atan2((p.z-z)/h,(p.x-x)/w)%math.tau)
 bm.to_mesh(body.data);bm.free();return count,boundary

def build_face(scene,body,rig,code):
 profile=FACE_PROFILES[code];surface=Surface(body);cx,zc,width,height=profile['mouth']
 # The centre may already have a legacy aperture. Read front depth from cheeks.
 points=[surface.hit(cx+sign*width*1.55,zc)[0] for sign in (-1,1)];cy=sum(p.y for p in points)/2
 if code=='CHAR_MARK':
  cy=float(np.median([p.y for p in points]+[surface.hit(cx,zc+height*1.8)[0].y,surface.hit(cx,zc-height*1.8)[0].y]))
 regions=[(cx,cy,zc,width*(1.65 if code=='CHAR_MARK' else 1.9),height*(1.0 if code=='CHAR_MARK' else 1.35))]
 eye_data=[]
 for x,z,w,h in profile['eyes']:
  p,_=surface.hit(x,z);eye_data.append((x,p.y,z,w,h));regions.append((x,p.y,z,w*1.1,h*1.1))
 removed,boundary=cut_surface(body,regions)
 if code=='CHAR_MARK':boundary=[] # regular loops avoid the damaged legacy aperture's non-star-shaped border
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
 jaw=rig.data.edit_bones.get('jaw') or rig.data.edit_bones.new('jaw');jaw.head=(cx,cy+.075,zc+.012);jaw.tail=(cx,cy+.035,zc-.022);jaw.parent=rig.data.edit_bones['head'];jaw.use_deform=True
 for side,(x,y,z,w,h) in zip(('R','L'),eye_data):
  b=rig.data.edit_bones.new('eye.'+side);b.head=(x,y+w*.75,z);b.tail=(x,y-w*.3,z);b.parent=rig.data.edit_bones['head'];b.use_deform=True
 bpy.ops.object.mode_set(mode='OBJECT')
 for prop in ['jaw_open','smile','frown','brow_up','brow_down','squint','eye_wide','blink.L','blink.R','gaze_yaw.L','gaze_yaw.R','gaze_pitch.L','gaze_pitch.R']+['viseme_'+v for v in VISEMES]:
  rig[prop]=1. if prop=='viseme_X' else 0.;rig.id_properties_ui(prop).update(min=-.5 if prop.startswith('gaze_') else 0,max=.5 if prop.startswith('gaze_') else 1)
 rig.pose.bones['jaw'].rotation_mode='XYZ';driver(rig.pose.bones['jaw'],'rotation_euler',rig,'jaw_open','max(0,min(1,c))*.12',0)
 skin=material(code+' master matched skin',(1,1,1),.65,True)
 interior=material(code+' oral interior',(.025,.006,.008));tooth=material(code+' teeth',(.76,.72,.64),.36);tongue=material(code+' tongue',(.36,.065,.075),.55)
 N=len(boundary) if boundary else 64;R=12;verts=[];weights=[];colors=[]
 if boundary:
  # Fit a smooth cheek surface to the actual cut boundary. Never sample the
  # discarded mouth's damaged geometry for interior lip positions.
  sample=np.array([[p.x-cx,p.z-zc,(p.x-cx)**2,(p.x-cx)*(p.z-zc),(p.z-zc)**2] for p in boundary]);fit=np.linalg.lstsq(sample,np.array([p.y-cy for p in boundary]),rcond=None)[0];coeff=np.concatenate(([cy],fit))
 cheek_colors=[surface.color(cx+sign*width*2.0,zc+.01,cy) for sign in (-1,1)]
 cheek=(cheek_colors[0]+cheek_colors[1])/2
 slope=max(-.8,min(.8,(points[1].y-points[0].y)/(width*3.1)))
 for k in range(R):
  f=k/(R-1);outer=smooth(f);outer_width=regions[0][3]*1.2;outer_height=regions[0][4]*1.2;rw=width+(outer_width-width)*outer;rh=.0003+(outer_height-.0003)*outer
  for j in range(N):
   a=math.atan2((boundary[j].z-zc)/height,(boundary[j].x-cx)/width) if boundary else j*math.tau/N
   if boundary:
    edge=boundary[j];x=(cx+width*math.cos(a))*(1-outer)+edge.x*outer;z=(zc+.0003*math.sin(a))*(1-outer)+edge.z*outer
   else:x=cx+rw*math.cos(a);z=zc+rh*math.sin(a)
   p,_=surface.hit(x,z,cy)
   # Stable lip surface synthesized from cheek depth; the deleted baked mouth
   # cannot pull its triangles through the nose, cheeks or mouth interior.
   if boundary:
    dx,dz=x-cx,z-zc;depth=float(np.array([1,dx,dz,dx*dx,dx*dz,dz*dz])@coeff);depth=depth*(1-outer**4)+edge.y*outer**4
   else:
    edge,_=surface.hit(cx+outer_width*math.cos(a),zc+outer_height*math.sin(a),cy);depth=cy*(1-smooth(f/.65))+edge.y*smooth(f/.65)
   if code=='CHAR_MARK':
    model=cy+slope*(x-cx)+1.5*((x-cx)**2+(z-zc)**2);expected=max(model-.015,min(model+.015,p.y));depth=model*(1-outer**3)+expected*outer**3
   depth-=.0012*(1-f)**2*abs(math.sin(a));verts.append((x,depth,z))
   jaw_weight=smooth(-math.sin(a))*((1-f)**3)*.82;binding=surface.weights(x,z,cy);blend=smooth(f/.65);binding={k:v*blend for k,v in binding.items()};binding['head']=binding.get('head',0)+(1-jaw_weight)*(1-blend);binding['jaw']=binding.get('jaw',0)+jaw_weight*(1-blend);weights.append(binding)
   c=cheek*(np.array([.96,.87,.87]) if f<.16 else 1)
   if f>.55:c=c*(1-smooth((f-.55)/.45))+surface.color(x,z,cy)*smooth((f-.55)/.45)
   colors.append(c)
 patch=native_mesh(scene,rig,body,code+'_FACIAL_TOPOLOGY',verts,ring_faces(N,R),skin,weights,colors);patch['topology']='concentric quad cheek-to-lip loops';patch['topology_revision']='V021';patch['ring_vertices']=N;patch['boundary_matched']=bool(boundary)
 patch.shape_key_add(name='Basis')
 for name,(wf,upper,lower,protrude,jaw_angle) in FORMS.items():
  key=patch.shape_key_add(name='viseme_'+name)
  for i,v in enumerate(key.data):
   f=(i//N)/(R-1);a=math.atan2((boundary[i%N].z-zc)/height,(boundary[i%N].x-cx)/width) if boundary else (i%N)*math.tau/N;influence=(1-f)**3
   v.co.x=cx+(v.co.x-cx)*(1+(wf-1)*influence)
   v.co.z+=math.sin(a)*((upper if math.sin(a)>0 else lower)-.0003)*influence
   v.co.y-=protrude*influence
  driver(key,'value',rig,'viseme_'+name,'max(0,min(1,c))')
 for name,sign in [('smile',1),('frown',-1)]:
  key=patch.shape_key_add(name=name)
  for i,v in enumerate(key.data):
   f=(i//N)/(R-1);a=math.atan2((boundary[i%N].z-zc)/height,(boundary[i%N].x-cx)/width) if boundary else (i%N)*math.tau/N;v.co.z+=sign*.0040*abs(math.cos(a))**4*(1-f)**2
   if name=='smile':v.co.x=cx+(v.co.x-cx)*(1+.05*(1-f)**2)
  driver(key,'value',rig,name,'max(0,min(1,c))')
 # Recessed cavity and upper/lower teeth are independent head/jaw skin parts.
 oral_depth=max(v[1] for v in verts)+.012
 verts=[];weights=[]
 for k in range(5):
  f=k/4
  for j in range(N):
   a=j*math.tau/N;verts.append((cx+width*1.24*(1-f*.8)*math.cos(a),oral_depth+.025*f,zc-.004+height*1.1*(1-f*.8)*math.sin(a)));w=smooth(-math.sin(a));weights.append({'head':1-w,'jaw':w})
 faces=ring_faces(N,5)+[tuple(4*N+j for j in range(N))];native_mesh(scene,rig,body,code+'_ORAL_CAVITY',verts,faces,interior,weights)
 for lower in (False,True):
  verts=[]
  for row in range(2):
   for i in range(25):
    x=(i/24*2-1)*width*.71;z=zc+(.0011+row*.0026 if not lower else -.0020-row*.0020);verts.append((cx+x,oral_depth+.001+.003*(x/(width*.71))**2,z))
  native_mesh(scene,rig,body,code+('_LOWER_TEETH' if lower else '_UPPER_TEETH'),verts,[(i,i+1,i+26,i+25) for i in range(24)],tooth,[{'jaw' if lower else 'head':1.} for _ in verts])
 verts=[(cx,oral_depth+.004,zc-.0035)]+[(cx+width*.43*math.cos(i*math.tau/32),oral_depth+.004,zc-.0035+.0020*math.sin(i*math.tau/32)) for i in range(32)]
 native_mesh(scene,rig,body,code+'_TONGUE',verts,[(0,i+1,(i+1)%32+1) for i in range(32)],tongue,[{'jaw':1.} for _ in verts])

 white=material(code+' sclera',(.80,.78,.72),.25);iris=material(code+' iris',(.14,.052,.018),.3);pupil=material(code+' pupil',(.003,.002,.001),.2)
 for side,(x,y,z,w,h) in zip(('R','L'),eye_data):
  centre=Vector((x,y+w*.72,z));rad=w*.90;zscale=h/w
  def eye_cap(label,angle,depth,mat):
   vs=[tuple(centre+Vector((0,-rad-depth,0)))];fs=[];n=48;r=8
   for k in range(1,r+1):
    theta=angle*k/r
    for j in range(n):
     a=math.tau*j/n;vs.append(tuple(centre+Vector((rad*math.sin(theta)*math.cos(a),-(rad+depth)*math.cos(theta),rad*math.sin(theta)*math.sin(a)*zscale))))
   fs=[(0,1+j,1+(j+1)%n) for j in range(n)]+[(1+k*n+j,1+(k+1)*n+j,1+(k+1)*n+(j+1)%n,1+k*n+(j+1)%n) for k in range(r-1) for j in range(n)]
   return native_mesh(scene,rig,body,code+'_'+label+'.'+side,vs,fs,mat,[{'eye.'+side:1.} for _ in vs])
  eye_cap('EYEBALL',1.63,0,white);eye_cap('IRIS',.52,.0005,iris);eye_cap('PUPIL',.24,.0008,pupil)
  bone=rig.pose.bones['eye.'+side];bone.rotation_mode='XYZ';driver(bone,'rotation_euler',rig,'gaze_yaw.'+side,'max(-.35,min(.35,c))',2);driver(bone,'rotation_euler',rig,'gaze_pitch.'+side,'max(-.25,min(.25,c))',0)
  vs=[];closed=[];colors=[];n=64;r=10
  eyelid_skin=(surface.color(x-w*1.4,z, y)+surface.color(x+w*1.4,z,y))/2
  for k in range(r):
   f=k/(r-1)
   for j in range(n):
    a=math.tau*j/n;xx=w*(.91+.49*f)*math.cos(a);zz=h*(.84+.60*f)*math.sin(a);p,_=surface.hit(x+xx,z+zz,y)
    def depth(z_local):
     q=rad**2-xx**2-(z_local/zscale)**2;globe=centre.y-math.sqrt(max(0,q))-.0012
     return min(p.y-.00065,globe) if q>0 else p.y-.00065
    vs.append((x+xx,depth(zz),z+zz));zz_closed=zz*smooth(f);closed.append((x+xx,depth(zz_closed),z+zz_closed))
    c=eyelid_skin
    if f>.6:c=c*(1-smooth((f-.6)/.4))+surface.color(x+xx,z+zz,y)*smooth((f-.6)/.4)
    colors.append(c)
  lid=native_mesh(scene,rig,body,code+'_EYELID.'+side,vs,ring_faces(n,r),skin,colors=colors);lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='blink')
  for v,co in zip(key.data,closed):v.co=co
  driver(key,'value',rig,'blink.'+side,'max(0,min(1,c))')
  squint=lid.shape_key_add(name='squint');wide=lid.shape_key_add(name='eye_wide')
  for i,(v,co) in enumerate(zip(squint.data,closed)):v.co=v.co.lerp(Vector(co),.32)
  for i,v in enumerate(wide.data):f=(i//n)/(r-1);v.co.z+=(v.co.z-z)*.18*(1-f)**2
  driver(squint,'value',rig,'squint','max(0,min(1,c))');driver(wide,'value',rig,'eye_wide','max(0,min(1,c))')
 # Expressions on the existing brow topology; mouth animation never touches it.
 body.shape_key_add(name='Basis')
 for name,amount in [('brow_up',.004),('brow_down',-.003)]:
  key=body.shape_key_add(name=name)
  for v in key.data:
   influence=max((math.exp(-((v.co.x-x)/(w*1.4))**2-((v.co.z-(z+h*1.45))/(h*.7))**2)*smooth((y+.05-v.co.y)/.04) for x,y,z,w,h in eye_data),default=0)
   v.co.z+=amount*influence
  driver(key,'value',rig,name,'max(0,min(1,c))')
 return {'removed_baked_faces':removed,'oral_quad_vertices':len(patch.data.vertices),'visemes':list(FORMS),'expressions':['smile','frown','brow_up','brow_down','squint','eye_wide'],'independent_eyes':2,'jaw_bone':'jaw','closed_rest_mouth':True,'topology_replaced':True,'identity_artist_approved':False,'professional_quality_approved':False}
