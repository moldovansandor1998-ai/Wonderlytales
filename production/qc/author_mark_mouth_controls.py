"""Reversible native jaw/mouth draft on the pinned Márk eye-authoring file.
Blender -b -t 2 --python this.py -- eye.blend output_dir audio_envelope.json
The envelope is an amplitude test, never phoneme-accurate lip synchronization.
"""
import bpy,bmesh,math,json,sys,hashlib,numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve();out=Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
env=json.loads(Path(args[2]).read_text())
sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha=='14e679e64db964de531bbd8bb1ae921c300c3d7c86a52edec51401073a91f756','Use only the reviewed V008 eye draft; never recut later facial work.'
assert env['phoneme_alignment'] is False and env['fps']==24
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE');rig.animation_data_clear()
for k in ['gaze_yaw','gaze_pitch','blink']:rig[k]=0.
body=next(o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
assert body.data.shape_keys is None
assert 'jaw' not in rig.data.bones
original_vertices=[v.co.copy() for v in body.data.vertices]
body.data.calc_loop_triangles()
original_faces=[t.vertices[:] for t in body.data.loop_triangles]
original_uvs=[[Vector((*body.data.uv_layers.active.data[l].uv,0)) for l in t.loops] for t in body.data.loop_triangles]
surface=BVHTree.FromPolygons(original_vertices,original_faces)
def hit(x,z):
    p,_,i,_=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    assert p is not None,(x,z)
    return p,i
atlas=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.label.lower())
pixels=np.empty(len(atlas.pixels),dtype=np.float32);atlas.pixels.foreach_get(pixels);pixels=pixels.reshape(atlas.size[1],atlas.size[0],4)
def sample(x,z):
    p,i=hit(x,z)
    uv=barycentric_transform(p,*[original_vertices[v] for v in original_faces[i]],*original_uvs[i])
    c=pixels[int(np.clip(uv.y,0,1)*(atlas.size[1]-1)),int(np.clip(uv.x,0,1)*(atlas.size[0]-1)),:3]
    c=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
    return c
# Local subdivision preserves original atlas UV and body weight layers.
zc=.762;before=len(body.data.vertices)
bm=bmesh.new();bm.from_mesh(body.data)
edges=[e for e in bm.edges if all((v.co.x/.032)**2+((v.co.z-zc)/.017)**2<1 and v.co.y<-.103 for v in e.verts)]
bmesh.ops.subdivide_edges(bm,edges=edges,cuts=2,use_grid_fill=True)
refined=len(bm.verts)-before
remove=[v for v in bm.verts if (v.co.x/.0215)**2+((v.co.z-zc)/.0028)**2<1 and v.co.y<-.105]
removed=len(remove);assert removed>10
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
# Native jaw joint below the head. Weighted lower face follows its rotation.
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
b=rig.data.edit_bones.new('jaw');b.head=(0,-.075,.789);b.tail=(0,-.115,.75);b.parent=rig.data.edit_bones['head'];b.use_connect=False
bpy.ops.object.mode_set(mode='OBJECT')
# Local bone X is world X, so X rotation opens the mandible down/back.
def smooth(x):x=max(0.,min(1.,x));return x*x*(3-2*x)
def weight(co):
    if co.z<.721 or co.y>-.068:return 0.
    return smooth((.766-co.z)/.008)*smooth((.059-abs(co.x))/.033)*smooth((co.z-.721)/.014)*smooth((-.068-co.y)/.025)
group=body.vertex_groups.new(name='jaw');head=body.vertex_groups.get('head');affected=0
for v in body.data.vertices:
    w=weight(v.co)
    if w>1e-6:
        old=next((g.weight for g in v.groups if g.group==head.index),0.)
        if old>0:
            group.add([v.index],old*w,'REPLACE');head.add([v.index],old*(1-w),'REPLACE');affected+=1
assert affected>100
rig['jaw_open']=0.;rig['mouth_round']=0.;rig.id_properties_ui('jaw_open').update(min=0,max=1,description='Mechanical jaw opening; not phoneme lip sync')
rig.id_properties_ui('mouth_round').update(min=0,max=1,description='Draft lip rounding, independent artist control')
def driver(target,path,index,prop,expression):
    f=target.driver_add(path,index) if index is not None else target.driver_add(path)
    d=f.driver;d.type='SCRIPTED';v=d.variables.new();v.name='control';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]';d.expression=expression
jaw=rig.pose.bones['jaw'];jaw.rotation_mode='XYZ';driver(jaw,'rotation_euler',0,'jaw_open','max(0,min(1,control))*0.25')
def mat(name,color,rough=.65):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
skin=mat('Draft lips and facial transition',(.5,.25,.16));vcol=skin.node_tree.nodes.new('ShaderNodeVertexColor');vcol.layer_name='NativeSkinColor';skin.node_tree.links.new(vcol.outputs['Color'],skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
dark=mat('Mouth cavity',(.025,.003,.005),.9);enamel=mat('Warm enamel',(.72,.65,.52),.32);tongue_mat=mat('Tongue',(.28,.055,.05),.55)
def mesh_obj(name,verts,faces,material,weights=None):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.materials.append(material);o=bpy.data.objects.new(name,m);s.collection.objects.link(o)
    for p in m.polygons:p.use_smooth=True
    hg=o.vertex_groups.new(name='head');jg=o.vertex_groups.new(name='jaw')
    for v in m.vertices:
        w=weight(v.co) if weights is None else weights[v.index]
        hg.add([v.index],1-w,'REPLACE');jg.add([v.index],w,'REPLACE')
    mod=o.modifiers.new('Native face skin','ARMATURE');mod.object=rig
    return o
# Conforming lip ribbon hides the atlas-painted mouth edge and supplies a clean rim.
N=96;R=10;verts=[];faces=[];colors=[]
for k in range(R):
    f=k/(R-1);w=.020+.011*f;h=.00035+.01165*f
    for j in range(N):
        t=2*math.pi*j/N;x=w*math.cos(t);z=zc+h*math.sin(t);p,_=hit(x,z)
        # Slight lip roll at inner rings, smooth transition to source surface.
        y=p.y-.0003-.0008*(1-f)*abs(math.sin(t))
        verts.append((x,y,z))
        side=-1 if x<0 else 1;c=sample(side*(.034-.002*abs(math.sin(t))),zc+.003*math.sin(t))
        lip=c*np.array([.94,.86,.84]);blend=smooth((f-.60)/.40);native=sample(x,z);colors.append(tuple(lip*(1-blend)+native*blend)+(1.,))
for k in range(R-1):
    for j in range(N):q=(j+1)%N;faces.append((k*N+j,(k+1)*N+j,(k+1)*N+q,k*N+q))
lip_weights=[]
for i,co in enumerate(verts):
    f=(i//N)/(R-1);t=2*math.pi*(i%N)/N
    lip_weights.append(smooth(.5-.5*math.sin(t))*(1-f)+weight(Vector(co))*f)
lips=mesh_obj('MOUTH_LIPS',verts,faces,skin,lip_weights)
col=lips.data.color_attributes.new(name='NativeSkinColor',type='FLOAT_COLOR',domain='CORNER')
for loop in lips.data.loops:col.data[loop.index].color=colors[loop.vertex_index]
lips.shape_key_add(name='Basis');roundkey=lips.shape_key_add(name='Round')
for i,v in enumerate(roundkey.data):
    f=(i//N)/(R-1);influence=(1-f)**2
    v.co.x*=1-.28*influence;v.co.y-=.002*influence;v.co.z+=(v.co.z-zc)*.6*influence
# Artist shape is available but is not inferred from audio amplitude.
driver(roundkey,'value',None,'mouth_round','max(0,min(1,control))')
# Recessed, closed bowl: actual dark geometry behind the aperture, no decal.
verts=[];faces=[];N=96;R=8
for k in range(R):
    f=k/(R-1);w=.025*(1-.92*f);h=.016*(1-.92*f)
    for j in range(N):
        t=2*math.pi*j/N;x=w*math.cos(t);z=zc-.003+h*math.sin(t);p,_=hit(x,z)
        verts.append((x,p.y+.003+.020*f,z))
for k in range(R-1):
    for j in range(N):q=(j+1)%N;faces.append((k*N+j,(k+1)*N+j,(k+1)*N+q,k*N+q))
faces.append(tuple((R-1)*N+j for j in range(N)))
cavity=mesh_obj('MOUTH_CAVITY',verts,faces,dark)
# Small upper tooth blocks are behind the upper lip, following the head.
teeth=[]
for i,x in enumerate([-.0125,-.0075,-.0025,.0025,.0075,.0125]):
    p,_=hit(x,zc+.001)
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,p.y+.005,zc-.0014));o=bpy.context.object;o.name='UPPER_TOOTH.%02d'%i;o.scale=(.0047,.0025,.0044);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(enamel);bevel=o.modifiers.new('Enamel edge','BEVEL');bevel.width=.00065;bevel.segments=3;o.modifiers.new('Tooth normals','WEIGHTED_NORMAL')
    bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone='head';o.matrix_world=world;teeth.append(o)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=1,location=(0,-.113,.751))
tongue=bpy.context.object;tongue.name='MOUTH_TONGUE';tongue.scale=(.012,.005,.0025);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);tongue.data.materials.append(tongue_mat)
for p in tongue.data.polygons:p.use_smooth=True
bpy.context.view_layer.update();world=tongue.matrix_world.copy();tongue.parent=rig;tongue.parent_type='BONE';tongue.parent_bone='jaw';tongue.matrix_world=world
for frame,value in enumerate(env['jaw_values'],1):
    rig['jaw_open']=float(value);rig.keyframe_insert(data_path='["jaw_open"]',frame=frame)
for fc in rig.animation_data.action.fcurves:
    for key in fc.keyframe_points:key.interpolation='LINEAR'
s.frame_start=1;s.frame_end=env['frame_count'];s.render.fps=24
# Eye test is neutral while jaw motion is reviewed.
s['status']='DRAFT_MOUTH_AUTHORING_NOT_APPROVED';s['facial_ready']=False;s['lip_sync_ready']=False;s['production_approved']=False;s['speech_test']='Amplitude-linked jaw only; no phoneme alignment'
s.cycles.samples=8;s.render.resolution_x=480;s.render.resolution_y=480;s.render.resolution_percentage=100
editor=s.sequence_editor_create();strip=editor.strips.new_sound('Recorded Hungarian dialogue',env['audio_path'],channel=1,frame_start=13)
for sound in bpy.data.sounds:
    if sound.filepath:sound.pack()
s.frame_set(1);rig.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/'CHAR_MARK_MOUTH_DRAFT.blend'),compress=True)
weightsums=[sum(g.weight for g in v.groups) for v in body.data.vertices]
assert min(weightsums)>.9999 and max(weightsums)<1.0001
report={'status':s['status'],'source_sha256':sha,'character':'CHAR_MARK','jaw_bone':True,'body_jaw_weighted_vertices':affected,'mouth_refined_vertices':refined,'removed_aperture_vertices':removed,'lip_vertices':len(lips.data.vertices),'upper_teeth':len(teeth),'mouth_cavity':True,'tongue':True,'controls':['gaze_yaw','gaze_pitch','blink','jaw_open','mouth_round'],'body_weight_sum_range':[min(weightsums),max(weightsums)],'speech_test':env,'phoneme_alignment':False,'lip_sync_ready':False,'facial_ready':False,'production_approved':False,'art_review':'PENDING_RENDER_REVIEW'}
(out/'mouth_authoring_report.json').write_text(json.dumps(report,indent=2))
print('MOUTH_AUTHORING_READY',affected,refined,removed)
