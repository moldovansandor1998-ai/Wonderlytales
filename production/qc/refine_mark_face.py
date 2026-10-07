"""Reversible V010 expression fork of the pinned V009 native speaking face.
Blender -b -t 2 --python refine_mark_face.py -- SOURCE OUTPUT
Speech shapes are artist controls, not an inferred phoneme alignment.
"""
import bpy, math, json, sys, hashlib
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

source, out = [Path(p).resolve() for p in sys.argv[sys.argv.index('--')+1:]]
out.mkdir(parents=True, exist_ok=True)
assert not (out/'CHAR_MARK_FACE_V010_DRAFT.blend').exists(), 'Choose a fresh output directory; preserve existing facial work.'
sha = hashlib.sha256(source.read_bytes()).hexdigest()
assert sha == 'd4478514f6ff3087b1b5e4ac4f2fe6dbe72e705e38cac8ec3f958ed4fd8e1f50'
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.context.scene
r=next(o for o in s.objects if o.type=='ARMATURE')
body=next(o for o in s.objects if o.type=='MESH' and o.vertex_groups.get('jaw') and len(o.data.vertices)>10000)
lips=bpy.data.objects['MOUTH_LIPS']
r.animation_data.action=None
for p in ['jaw_open','mouth_round','blink','gaze_yaw','gaze_pitch']:r[p]=0.
def smooth(v):
    v=max(0.,min(1.,v));return v*v*(3-2*v)
def jaw_weight(co):
    x,y,z=co
    if z<.710 or y>-.066:return 0.
    return smooth((.774-z)/.025)*smooth((.070-abs(x))/.042)*smooth((z-.710)/.022)*smooth((-.066-y)/.027)
# Fit surrounding native skin rather than adding more subdivisions to its dent.
samples=[]
for v in body.data.vertices:
    x,y,z=v.co;rad=(x/.033)**2+((z-.762)/.018)**2
    if 1<rad<2.1 and y<-.104:samples.append((x,z-.762,y))
assert len(samples)>100
a=np.array(samples);x,z,y=a.T
fit=np.linalg.lstsq(np.column_stack([x*x,z*z,x*z,x,z,np.ones(len(x))]),y,rcond=None)[0]
def fitted_y(x,z):
    z-=.762;return float(np.dot([x*x,z*z,x*z,x,z,1],fit))
sculpted=0
for v in body.data.vertices:
    x,y,z=v.co;rad=math.sqrt((x/.034)**2+((z-.762)/.019)**2)
    if rad<1.05 and y<-.104:
        blend=.85*smooth((1.05-rad)/.45)
        v.co.y=y+max(-.0015,min(.0015,(fitted_y(x,z)-y)*blend));sculpted+=1
# Broad jaw gradient removes the abrupt stripe through lower cheeks.
head=body.vertex_groups['head'];jg=body.vertex_groups['jaw']
for v in body.data.vertices:
    old={g.group:g.weight for g in v.groups};total=old.get(head.index,0)+old.get(jg.index,0)
    if total:
        w=jaw_weight(v.co);head.add([v.index],total*(1-w),'REPLACE');jg.add([v.index],total*w,'REPLACE')
body.data.update()
surface=BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices],[p.vertices[:] for p in body.data.polygons])
# Fit the lip roll to the smoothed skin, retaining exact outer-ring body weights.
basis=lips.data.shape_keys.key_blocks['Basis'];rnd=lips.data.shape_keys.key_blocks['Round']
for i,v in enumerate(basis.data):
    f=(i//96)/9;t=2*math.pi*(i%96)/96;x,y,z=v.co
    p,*_=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    target=(p.y if p is not None and p.y<-.103 else fitted_y(x,z))-.00012-.00065*(1-f)*abs(math.sin(t))
    delta=max(-.0015,min(.0015,target-y))
    v.co.y=y+delta;lips.data.vertices[i].co.y=y+delta;rnd.data[i].co.y+=delta
    local=smooth(.5-.5*math.sin(t))
    w=local*(1-smooth(f))+jaw_weight(v.co)*smooth(f)
    lips.vertex_groups['head'].add([i],1-w,'REPLACE');lips.vertex_groups['jaw'].add([i],w,'REPLACE')
for name in ['mouth_spread','mouth_press','smile','brow_raise','brow_worry']:
    r[name]=0.;r.id_properties_ui(name).update(min=0,max=1,description='Artist-authored expression draft')
def drive(key,prop):
    d=key.driver_add('value').driver;d.type='SCRIPTED';v=d.variables.new();v.name='c';v.type='SINGLE_PROP';v.targets[0].id=r;v.targets[0].data_path='["'+prop+'"]';d.expression='max(0,min(1,c))'
def key(o,name,prop,offset):
    if o.data.shape_keys is None:o.shape_key_add(name='Basis')
    k=o.shape_key_add(name=name)
    for v in k.data:v.co+=Vector(offset(v.co))
    drive(k,prop);return k
def lip_spread(co):
    x,y,z=co;f=smooth((.034-abs(x))/.012)*smooth((.016-abs(z-.762))/.010)
    return (x*.18*f,0,0)
def lip_press(co):
    x,y,z=co;f=smooth((.034-abs(x))/.012)*smooth((.016-abs(z-.762))/.010)
    return (0,-.0004*f,-(z-.762)*.82*f)
def smile(co):
    x,y,z=co
    f=math.exp(-((abs(x)-.024)/.019)**2-((z-.766)/.016)**2)*smooth((-.085-y)/.018)
    return (math.copysign(.0015*f,x),-.0006*f,.0035*f)
key(lips,'Spread','mouth_spread',lip_spread)
key(lips,'Press','mouth_press',lip_press)
key(lips,'Smile','smile',smile)
key(body,'Smile','smile',smile)
def brow(co,worry=False):
    x,y,z=co
    f=math.exp(-((abs(x)-.034)/.024)**2-((z-.848)/.009)**2)*smooth((-.08-y)/.02)
    lift=(.004*(1-min(1,abs(x)/.06)) if worry else .004)*f
    return (0,0,lift)
key(body,'BrowRaise','brow_raise',brow)
key(body,'BrowWorry','brow_worry',lambda co:brow(co,True))
s['status']='DRAFT_EXPRESSION_AUTHORING_NOT_APPROVED'
s['lip_sync_ready']=False;s['facial_ready']=False;s['production_approved']=False
s['speech_test']='Artist lip shapes and expression controls; alignment not yet verified'
s.cycles.samples=16
s.frame_set(1);r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
bpy.ops.file.pack_all();dest=out/'CHAR_MARK_FACE_V010_DRAFT.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
report={'version':'V010_EXPRESSION_DRAFT','status':s['status'],'source_sha256':sha,'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'sculpted_vertices':sculpted,'skin_fit_samples':len(samples),'controls':[p for p in ['jaw_open','mouth_round','mouth_spread','mouth_press','smile','brow_raise','brow_worry','gaze_yaw','gaze_pitch','blink']],'phoneme_alignment':False,'production_approved':False,'quality_gate_passed':False}
(out/'expression_report.json').write_text(json.dumps(report,indent=2))
print('FACE_FORK_SAVED',sculpted)
