"""Fast review renderer; consumes evaluated native meshes, never approximates rigs."""
import sys,struct,json,subprocess,os
from pathlib import Path
os.environ.setdefault('LP_NUM_THREADS','2')
import numpy as np,moderngl

def receive():
 n=struct.unpack('<Q',sys.stdin.buffer.read(8))[0];data=bytearray()
 while len(data)<n:data.extend(sys.stdin.buffer.read(n-len(data)))
 return bytes(data)
config=json.loads(receive());w,h=config['width'],config['height'];ctx=moderngl.create_standalone_context(backend='egl');fb=ctx.simple_framebuffer((w,h));fb.use();ctx.enable(moderngl.DEPTH_TEST)
prog=ctx.program(vertex_shader='''#version 330
uniform mat4 vp;uniform mat4 model;uniform mat3 normal_model;in vec3 p;in vec3 n;in vec2 uv;in vec4 color;out vec3 N;out vec2 U;out vec4 C;
void main(){gl_Position=vp*model*vec4(p,1);N=normalize(normal_model*n);U=uv;C=color;}
''',fragment_shader='''#version 330
uniform sampler2D tex;uniform bool textured;uniform vec4 base;in vec3 N;in vec2 U;in vec4 C;out vec4 frag;
void main(){vec4 a=base*C;if(textured)a*=texture(tex,U);if(a.a<.1)discard;float d=.40+.42*max(0.,dot(normalize(N),normalize(vec3(-.6,-1.,1.7))))+.18*max(0.,dot(normalize(N),normalize(vec3(1.,.5,.5))));frag=vec4(pow(max(a.rgb*d,vec3(0)),vec3(.8)),1);}
''');meshes=[]
for m in config['meshes']:
 static=np.frombuffer(receive(),dtype='<f4').reshape(-1,6);vbo=ctx.buffer(reserve=len(static)*24);sbo=ctx.buffer(static.tobytes());vao=ctx.vertex_array(prog,[(vbo,'3f 3f','p','n'),(sbo,'2f 4f','uv','color')]);tex=None
 if m['texture']:
  from PIL import Image
  im=Image.open(m['texture']).convert('RGBA').transpose(Image.Transpose.FLIP_TOP_BOTTOM);tex=ctx.texture(im.size,4,im.tobytes());tex.filter=(moderngl.LINEAR,moderngl.LINEAR)
 meshes.append((m,vbo,vao,tex))
cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','24','-i','-','-vf',"vflip,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='WonderlyTales animációs teszt - előnézeti világítás':fontsize=13:fontcolor=white:x=10:y=h-24:box=1:boxcolor=black@0.55",'-an','-c:v','libx264','-preset','fast','-crf','20',config['output']]
ff=subprocess.Popen(cmd,stdin=subprocess.PIPE);sys.stdout.write('READY\n');sys.stdout.flush()
for f in range(config['frames']):
 frame=json.loads(receive());vp=np.array(frame['vp'],dtype='f4');prog['vp'].write(vp.T.tobytes());fb.clear(.16,.20,.25,1)
 for (m,buf,vao,tex),matrix in zip(meshes,frame['models']):
  buf.write(receive());matrix=np.array(matrix,dtype='f4');prog['model'].write(matrix.T.tobytes());prog['normal_model'].write(np.linalg.inv(matrix[:3,:3]).astype('f4').tobytes());prog['base'].value=m['base'];prog['textured'].value=tex is not None
  if tex:tex.use(0)
  vao.render()
 ff.stdin.write(fb.read(components=3));sys.stdout.write('FRAME\n');sys.stdout.flush()
ff.stdin.close();code=ff.wait()
if code:raise RuntimeError('Encoding failed')
with open(config['output'],'rb') as file:os.fsync(file.fileno())
