"""Render sampled skeletal/morph GLTF animation as a explicitly draft review.
Requires moderngl, numpy and Pillow. Source frame cameras are Blender evaluated.
"""
import sys,json,struct,time,io,subprocess
from pathlib import Path
import moderngl,numpy as np
from PIL import Image
source=Path(sys.argv[1]);output=Path(sys.argv[2]);raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);blob=raw[28+size:];meta=json.loads(source.with_suffix('.json').read_text());nodes=doc['nodes']
def access(i):
 a=doc['accessors'][i];dim={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5122:'<i2',5121:'u1'}[a['componentType']])
 if 'bufferView' in a:
  v=doc['bufferViews'][a['bufferView']];r=np.ndarray((a['count'],dim),dt,blob,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*dim),dt.itemsize)).copy()
 else:r=np.zeros((a['count'],dim),dt)
 if 'sparse' in a:
  sp=a['sparse'];iv=doc['bufferViews'][sp['indices']['bufferView']];idt=np.dtype({5121:'u1',5123:'<u2',5125:'<u4'}[sp['indices']['componentType']]);idx=np.frombuffer(blob,idt,sp['count'],iv.get('byteOffset',0)+sp['indices'].get('byteOffset',0));vv=doc['bufferViews'][sp['values']['bufferView']];vals=np.frombuffer(blob,dt,sp['count']*dim,vv.get('byteOffset',0)+sp['values'].get('byteOffset',0)).reshape(-1,dim);r[idx]=vals
 if a.get('normalized'):r=r.astype('f4')/np.iinfo(dt).max
 return r
channels=[]
for animation in doc.get('animations',[]):
 for ch in animation['channels']:
  sam=animation['samplers'][ch['sampler']];channels.append((ch['target']['node'],ch['target']['path'],access(sam['input']).ravel(),access(sam['output']),sam.get('interpolation','LINEAR')))
start_time=min((c[2][0] for c in channels),default=0.)
def sample(c,t):
 i,path,ts,vs,method=c;d=len(nodes[i].get('weights',doc.get('meshes',[])[nodes[i]['mesh']].get('weights',[]))) if path=='weights' else vs.shape[1]
 if path=='weights':vs=vs.reshape(len(ts)*(3 if method=='CUBICSPLINE' else 1),d)
 k=max(0,min(len(ts)-1,int(np.searchsorted(ts,t,side='right')-1)));j=min(k+1,len(ts)-1);u=0 if j==k else max(0,min(1,(t-ts[k])/(ts[j]-ts[k])))
 if method=='CUBICSPLINE':
  dt=ts[j]-ts[k];return (2*u**3-3*u*u+1)*vs[3*k+1]+(u**3-2*u*u+u)*dt*vs[3*k+2]+(-2*u**3+3*u*u)*vs[3*j+1]+(u**3-u*u)*dt*vs[3*j]
 if method=='STEP':return vs[k]
 a=vs[k];b=vs[j]
 if path=='rotation' and np.dot(a,b)<0:b=-b
 v=a*(1-u)+b*u
 if path=='rotation':v=v/max(1e-8,np.linalg.norm(v))
 return v
def local(n):
 if 'matrix' in n:return np.array(n['matrix'],dtype='f4').reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4,dtype='f4');m[:3,:3]=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];m[:3,:3]=m[:3,:3]@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
world={}
def walk(i,parent):
 world[i]=parent@local(nodes[i])
 for j in nodes[i].get('children',[]):walk(j,world[i])
ctx=moderngl.create_standalone_context(backend='egl');fbo=ctx.simple_framebuffer((960,540));fbo.use();ctx.enable(moderngl.DEPTH_TEST)
prog=ctx.program(vertex_shader='''#version 330
uniform mat4 model;uniform mat4 vp;uniform mat4 shadowvp;uniform mat4 bones[64];uniform int skinned;uniform vec4 mw;
in vec3 pos;in vec3 nor;in vec2 uv;in vec4 color;in vec4 joints;in vec4 weights;in vec3 m0;in vec3 m1;in vec3 m2;in vec3 m3;
out vec3 n;out vec2 t;out vec4 co;out vec3 wp;out vec4 shadowpos;
void main(){vec4 p=vec4(pos+m0*mw.x+m1*mw.y+m2*mw.z+m3*mw.w,1);mat4 skin=mat4(1);if(skinned==1){skin=bones[int(joints.x)]*weights.x+bones[int(joints.y)]*weights.y+bones[int(joints.z)]*weights.z+bones[int(joints.w)]*weights.w;}vec4 w=model*skin*p;wp=w.xyz;shadowpos=shadowvp*w;gl_Position=vp*w;n=mat3(model*skin)*nor;t=uv;co=color;}''',fragment_shader='''#version 330
uniform sampler2D tex;uniform sampler2D shadowtex;uniform int shadowpass;uniform int hastex;uniform vec4 factor;uniform vec3 emission;uniform int procedural;
in vec3 n;in vec2 t;in vec4 co;in vec3 wp;in vec4 shadowpos;out vec4 frag;
void main(){vec4 col=factor*co;if(hastex==1){vec4 tc=texture(tex,t);col*=vec4(pow(max(tc.rgb,vec3(0)),vec3(2.2)),tc.a);}if(col.a<.3)discard;if(shadowpass==1){frag=vec4(1);return;}vec3 a=max(col.rgb,vec3(0));if(procedural==1){float noise=.88+.06*sin(wp.x*18+sin(wp.y*9))*sin(wp.z*17);a*=noise;}float d=max(0.,dot(normalize(n),normalize(vec3(-.35,.60,.72))));vec3 q=shadowpos.xyz/shadowpos.w*.5+.5;float sh=1.;if(q.x>0&&q.x<1&&q.y>0&&q.y<1&&q.z<1){sh=0.;for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){float z=texture(shadowtex,q.xy+vec2(x,y)/1024.).r;sh+=(q.z-.0007<=z?1.:0.);}}sh/=9.;}vec3 lit=a*(vec3(.16,.18,.21)+d*sh*vec3(.92,.84,.72))+emission;lit=clamp((lit*(2.51*lit+.03))/(lit*(2.43*lit+.59)+.14),0.,1.);frag=vec4(pow(lit,vec3(1./2.2)),col.a);}''')
depthtex=ctx.depth_texture((1024,1024));depthtex.compare_func='';depthtex.filter=(moderngl.NEAREST,moderngl.NEAREST);shadowfbo=ctx.framebuffer(depth_attachment=depthtex);prog['shadowtex'].value=1;depthtex.use(1)
textures={};draws=[]
def texture(i):
 if i in textures:return textures[i]
 im=doc['images'][doc['textures'][i]['source']];v=doc['bufferViews'][im['bufferView']];pic=Image.open(io.BytesIO(blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA');tx=ctx.texture(pic.size,4,pic.tobytes());tx.build_mipmaps();textures[i]=tx;return tx
for i,node in enumerate(nodes):
 if 'mesh' not in node:continue
 for p in doc['meshes'][node['mesh']]['primitives']:
  a=p['attributes'];v=access(a['POSITION']).astype('f4');nn=access(a['NORMAL']) if 'NORMAL' in a else np.tile([0,1,0],(len(v),1));uv=access(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else np.zeros((len(v),2));color=access(a['COLOR_0']) if 'COLOR_0' in a else np.ones((len(v),4))
  if color.shape[1]==3:color=np.column_stack([color,np.ones(len(v))])
  j=access(a['JOINTS_0']) if 'JOINTS_0' in a else np.zeros((len(v),4));w=access(a['WEIGHTS_0']) if 'WEIGHTS_0' in a else np.zeros((len(v),4));morph=[access(t['POSITION']) if 'POSITION' in t else np.zeros_like(v) for t in p.get('targets',[])]
  if len(morph)>4:raise ValueError('More than four morph targets need a larger shader')
  morph+= [np.zeros_like(v) for _ in range(4-len(morph))];buf=ctx.buffer(np.column_stack([v,nn,uv,color,j,w,*morph]).astype('f4').tobytes());ib=ctx.buffer(access(p['indices']).astype('u4').tobytes());vao=ctx.vertex_array(prog,[(buf,'3f 3f 2f 4f 4f 4f 3f 3f 3f 3f','pos','nor','uv','color','joints','weights','m0','m1','m2','m3')],ib,index_element_size=4);m=doc.get('materials',[{}])[p.get('material',0)];pb=m.get('pbrMetallicRoughness',{});name=m.get('name','');recipe=meta['materials'].get(name,{});tx=texture(pb['baseColorTexture']['index']) if 'baseColorTexture' in pb else None;lo=v.min(axis=0)-.20;hi=v.max(axis=0)+.20;corners=np.array([[x,y,z,1] for x in [lo[0],hi[0]] for y in [lo[1],hi[1]] for z in [lo[2],hi[2]]],dtype='f4');draws.append((i,vao,recipe.get('baseColorFactor',pb.get('baseColorFactor',[1,1,1,1])),m.get('emissiveFactor',[0,0,0]),tx,name,bool(recipe),corners))
skins=[]
for skin in doc.get('skins',[]):
 if len(skin['joints'])>64:raise ValueError('Skin exceeds uniform palette')
 skins.append((skin['joints'],access(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)))
print('PREPARED',len(draws),'draws',len(channels),'channels',len(skins),'skins',start_time,flush=True)
args=['ffmpeg','-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size','960x540','-framerate','12','-i','-','-vf','fps=24','-an','-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p',str(output.with_suffix('.partial.mp4'))];pipe=subprocess.Popen(args,stdin=subprocess.PIPE);started=time.time()
first=int(sys.argv[3]) if len(sys.argv)>3 else 0
last=int(sys.argv[4]) if len(sys.argv)>4 else len(meta['frames'])
for idx in range(first,last):
 f=meta['frames'][idx]
 t=start_time+idx/12
 for c in channels:nodes[c[0]][c[1]]=sample(c,t).tolist()
 for i in doc['scenes'][doc.get('scene',0)]['nodes']:walk(i,np.eye(4,dtype='f4'))
 y=f['yfov'];near=.025;far=150.;aspect=960/540;scale=1/np.tan(y/2);proj=np.array([[scale/aspect,0,0,0],[0,scale,0,0],[0,0,(far+near)/(near-far),2*far*near/(near-far)],[0,0,-1,0]],dtype='f4');vp=proj@np.linalg.inv(np.array(f['camera_matrix']));prog['vp'].write(vp.T.astype('f4').tobytes());fbo.clear(.25,.34,.40,1)
 center=sum((world[i][:3,3] for i in range(len(nodes)) if 'skin' in nodes[i]),np.zeros(3))/max(1,sum('skin' in n for n in nodes));direction=np.array([-.35,.60,.72]);direction/=np.linalg.norm(direction);eye=center+direction*30;forward=(center-eye)/30;right=np.cross(forward,[0,1,0]);right/=np.linalg.norm(right);up=np.cross(right,forward);view=np.eye(4);view[:3,:3]=np.array([right,up,-forward]);view[:3,3]=-view[:3,:3]@eye;ortho=np.diag([1/12,1/12,-2/70,1.]);ortho[2,3]=-1.;svp=ortho@view;prog['shadowvp'].write(svp.T.astype('f4').tobytes());palettes={}
 for shadowpass in [1,0]:
  prog['shadowpass'].value=shadowpass
  if shadowpass:shadowfbo.use();ctx.viewport=(0,0,1024,1024);shadowfbo.clear(depth=1.);prog['vp'].write(svp.T.astype('f4').tobytes())
  else:fbo.use();ctx.viewport=(0,0,960,540);fbo.clear(.25,.34,.40,1);prog['vp'].write(vp.T.astype('f4').tobytes());depthtex.use(1)
  for i,vao,factor,em,tx,name,proc,corners in draws:
   model=world[i];clip=corners@((svp if shadowpass else vp)@model).T
   if any(np.all(clip[:,k]<-clip[:,3]) or np.all(clip[:,k]>clip[:,3]) for k in range(3)):continue
   prog['model'].write(model.T.astype('f4').tobytes());skin=nodes[i].get('skin');prog['skinned'].value=int(skin is not None)
   if skin is not None:
    if (i,skin) not in palettes:
     joints,ibm=skins[skin];palette=np.tile(np.eye(4,dtype='f4'),(64,1,1));inv=np.linalg.inv(model)
     for k,joint in enumerate(joints):palette[k]=inv@world[joint]@ibm[k]
     palettes[(i,skin)]=palette.transpose(0,2,1).astype('f4').tobytes()
    prog['bones'].write(palettes[(i,skin)])
   weights=nodes[i].get('weights',doc['meshes'][nodes[i]['mesh']].get('weights',[]));prog['mw'].value=(list(weights)+[0]*4)[:4];prog['factor'].value=factor;prog['emission'].value=f['emission'].get(name,em);prog['procedural'].value=int(proc);prog['hastex'].value=int(tx is not None)
   if tx:tx.use(0)
   vao.render()
 data=np.frombuffer(fbo.read(components=3,alignment=1),dtype='u1').reshape(540,960,3)[::-1].tobytes();pipe.stdin.write(data)
 if idx%120==0 or idx in [132,180,252,444,624,708,756]:Image.frombytes('RGB',(960,540),data).save(output.with_name(output.stem+f'_proof_{idx:04}.png'))
 if idx%120==0:print('FRAME',idx+1,len(meta['frames']),'elapsed',round(time.time()-started,1),flush=True)
pipe.stdin.close();code=pipe.wait()
if code:raise RuntimeError('ffmpeg failed '+str(code))
output.with_suffix('.partial.mp4').replace(output);print('VIDEO_COMPLETE',last-first,time.time()-started,flush=True)
