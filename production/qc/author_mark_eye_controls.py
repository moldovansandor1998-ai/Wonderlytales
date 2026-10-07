"""Draft eye sockets, independent eyes, gaze and blink on the native Márk mesh.

Blender --python this.py -- native.blend output_directory
This is a reversible authoring fork, not a production-approved facial rig.
"""
import bpy, bmesh, math, json, sys, hashlib, subprocess, numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]).resolve(); out=Path(args[1]).resolve(); out.mkdir(parents=True,exist_ok=True)
source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha=='ea908b40eadb3ce98cdeb570ce1875ea6fcf4f12ed054fe354778c0673520ecd', 'Landmarks are reviewed only against the original Márk V007 body draft; never recut a later eye/facial asset.'
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.context.scene
rig=next(o for o in s.objects if o.type=='ARMATURE')
assert rig.name.startswith('CHAR_MARK'), 'Landmarks apply only to this Márk draft.'
mesh=next(o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers))
assert mesh.data.shape_keys is None, 'Do not overwrite later facial work.'
for o in list(s.objects):
    if o not in [rig,mesh]:bpy.data.objects.remove(o,do_unlink=True)
rig.animation_data_clear()
for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0)
bpy.context.view_layer.update()
assert mesh.matrix_world == Matrix.Identity(4), 'Landmarks require the normalized identity transform.'
surface=BVHTree.FromPolygons([v.co.copy() for v in mesh.data.vertices],[p.vertices[:] for p in mesh.data.polygons])
def hit(x,z):
    p,*_=surface.ray_cast(Vector((x,-1,z)),Vector((0,1,0)))
    assert p is not None, (x,z)
    return p.y
centers=[Vector((x,hit(x,.822)+.006,.822)) for x in [-.034,.034]]
lid_uvs=[]
original_uv=mesh.data.uv_layers.active
image=next(n.image for n in mesh.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.label.lower())
pixels=np.empty(len(image.pixels),dtype=np.float32);image.pixels.foreach_get(pixels)
pixels=pixels.reshape(image.size[1],image.size[0],4)
def skin_color(uv):
    x=int(np.clip(uv.x,0,1)*(image.size[0]-1));y=int(np.clip(uv.y,0,1)*(image.size[1]-1))
    c=pixels[y,x,:3]
    # The source atlas is sRGB; shader vertex colors use linear values.
    c=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
    return (*map(float,c),1)
for c in centers:
    samples=[]
    for j in range(96):
        t=2*math.pi*j/96
        # Sample nearby cheek skin, avoiding the old atlas-painted eye whites.
        p,_,index,_=surface.ray_cast(Vector((c.x+.023*math.cos(t),-1,c.z-.024)),Vector((0,1,0)))
        poly=mesh.data.polygons[index]; assert len(poly.vertices)==3
        points=[mesh.data.vertices[i].co for i in poly.vertices]
        uvs=[Vector((*original_uv.data[i].uv,0)) for i in poly.loop_indices]
        samples.append(barycentric_transform(p,*points,*uvs))
    lid_uvs.append(samples)
before=len(mesh.data.vertices)
bm=bmesh.new();bm.from_mesh(mesh.data)
local_edges=[e for e in bm.edges if all(any(((v.co.x-c.x)/.031)**2+((v.co.z-c.z)/.025)**2<1 and v.co.y<c.y+.012 for c in centers) for v in e.verts)]
bmesh.ops.subdivide_edges(bm,edges=local_edges,cuts=2,use_grid_fill=True)
subdivided_vertices=len(bm.verts)-before
remove=[v for v in bm.verts if any(((v.co.x-c.x)/.0175)**2+((v.co.z-c.z)/.0125)**2<1 and v.co.y<c.y+.005 for c in centers)]
socket_vertices_removed=len(remove)
bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(mesh.data);bm.free()

def mat(name,color,roughness=.4):
    m=bpy.data.materials.new(name);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
    return m
white=mat('Warm eye white',(.79,.77,.70),.2)
brown=mat('Brown iris',(.12,.048,.012),.32)
pupil=mat('Pupil',(.002,.001,.0005),.15)
skin=mat('Draft eyelid skin',(.70,.39,.27),.72)
colors=skin.node_tree.nodes.new('ShaderNodeVertexColor');colors.layer_name='NativeSkinColor'
skin.node_tree.links.new(colors.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
rig['gaze_yaw']=0.;rig['gaze_pitch']=0.;rig['blink']=0.
for key,lo,hi in [('gaze_yaw',-20,20),('gaze_pitch',-15,15),('blink',0,1)]:
    rig.id_properties_ui(key).update(min=lo,max=hi,description='Draft face control')
def drive(target,path,index,prop,expression):
    fc=target.driver_add(path,index) if index is not None else target.driver_add(path)
    d=fc.driver;d.type='SCRIPTED';v=d.variables.new();v.name='control';v.type='SINGLE_PROP';v.targets[0].id=rig;v.targets[0].data_path='["'+prop+'"]';d.expression=expression
def parent_head(o):
    world=o.matrix_world.copy();o.parent=rig;o.parent_type='BONE';o.parent_bone='head';o.matrix_world=world
def new_mesh(name,verts,faces,material):
    m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.materials.append(material)
    o=bpy.data.objects.new(name,m);s.collection.objects.link(o)
    for p in m.polygons:p.use_smooth=True
    return o
def cap(name,angle,radius,material,anchor):
    verts=[(0,-radius,0)];faces=[];N=96;R=8
    for k in range(1,R+1):
        t=angle*k/R
        for j in range(N):
            a=2*math.pi*j/N;verts.append((radius*math.sin(t)*math.cos(a),-radius*math.cos(t),radius*math.sin(t)*math.sin(a)))
    for j in range(N):faces.append((0,1+j,1+(j+1)%N))
    for k in range(R-1):
        a=1+k*N;b=a+N
        for j in range(N):q=(j+1)%N;faces.append((a+j,b+j,b+q,a+q))
    o=new_mesh(name,verts,faces,material);o.parent=anchor
    return o

eyes=[];lids=[]
for side,c,uv_samples in zip(['R','L'],centers,lid_uvs):
    mount=bpy.data.objects.new('EYE_HEAD_MOUNT.'+side,None);s.collection.objects.link(mount);mount.location=c
    mount.scale=(1,1,.86);bpy.context.view_layer.update();parent_head(mount)
    anchor=bpy.data.objects.new('EYE_GAZE.'+side,None);s.collection.objects.link(anchor);anchor.parent=mount
    drive(anchor,'rotation_euler',2,'gaze_yaw','control*0.01745329252')
    drive(anchor,'rotation_euler',0,'gaze_pitch','control*0.01745329252')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=.018)
    ball=bpy.context.object;ball.name='EYEBALL.'+side;ball.data.materials.append(white);ball.parent=anchor;ball.location=(0,0,0)
    for p in ball.data.polygons:p.use_smooth=True
    cap('IRIS.'+side,.56,.01806,brown,anchor)
    cap('PUPIL.'+side,.235,.01812,pupil,anchor)
    eyes.append(ball)
    # Conforming lid strips. Blink moves the inner edge to the closure line.
    verts=[];closed=[];faces=[];N=96;R=6
    for k in range(R):
        f=k/(R-1);w=.017+.006*f;h=.0115+.008*f
        for j in range(N):
            t=2*math.pi*j/N;x=w*math.cos(t);z=h*math.sin(t)
            base=hit(c.x+x,c.z+z)
            opening_z=z;closure_z=z*f
            def depth(local_z):
                r2=.018**2-x*x-(local_z/.86)**2
                globe=c.y-math.sqrt(max(0,r2))-.00035
                return min(base-.0003,globe) if r2>0 else base-.0003
            verts.append((c.x+x,depth(opening_z),c.z+opening_z))
            closed.append((c.x+x,depth(closure_z),c.z+closure_z))
    for k in range(R-1):
        for j in range(N):q=(j+1)%N;faces.append((k*N+j,(k+1)*N+j,(k+1)*N+q,k*N+q))
    lid=new_mesh('EYELIDS.'+side,verts,faces,skin)
    colors=lid.data.color_attributes.new(name='NativeSkinColor',type='FLOAT_COLOR',domain='CORNER')
    for loop in lid.data.loops:colors.data[loop.index].color=skin_color(uv_samples[loop.vertex_index%N])
    lid.shape_key_add(name='Basis');key=lid.shape_key_add(name='Blink')
    for v,p in zip(key.data,closed):v.co=p
    drive(key,'value',None,'blink','max(0,min(1,control))')
    bpy.context.view_layer.update();parent_head(lid);lids.append(lid)

# A short, explicit mechanical gaze/blink test, with no speech claims.
for frame,yaw,pitch,blink in [(1,0,0,0),(9,14,0,0),(15,14,0,0),(18,14,0,1),(21,14,0,0),(32,-14,3,0),(42,-14,3,0),(48,0,0,0)]:
    for prop,value in [('gaze_yaw',yaw),('gaze_pitch',pitch),('blink',blink)]:
        rig[prop]=value;rig.keyframe_insert(data_path='["'+prop+'"]',frame=frame)
s.frame_start=1;s.frame_end=48;s.render.fps=24
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=16;s.cycles.use_denoising=True
s.render.resolution_x=640;s.render.resolution_y=640;s.render.resolution_percentage=100
s.world=bpy.data.worlds.new('Face studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[1].default_value=.15
for loc,power,size in [((-.3,-.5,1.1),3,.4),((.3,-.2,.9),.5,.3)]:
    d=bpy.data.lights.new('Face light','AREA');d.energy=power;d.size=size
    o=bpy.data.objects.new('Face light',d);s.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,.84))-o.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Face camera',bpy.data.cameras.new('Face camera'));s.collection.objects.link(camera);camera.location=(0,-1,.84);camera.rotation_euler=(math.pi/2,0,0);camera.data.type='ORTHO';camera.data.ortho_scale=.26;s.camera=camera
s['status']='DRAFT_EYE_AUTHORING_NOT_APPROVED';s['production_approved']=False;s['facial_ready']=False;s['lip_sync_ready']=False
s.frame_set(1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'CHAR_MARK_EYE_DRAFT.blend'),compress=True)
report={'source_sha256':source_sha,'character':'CHAR_MARK','status':'DRAFT_EYE_AUTHORING_NOT_APPROVED','original_vertices':before,'local_refinement_added_vertices':subdivided_vertices,'removed_socket_vertices':socket_vertices_removed,'output_vertices':len(mesh.data.vertices),'independent_eyes':len(eyes),'blink_shape_keys':len(lids),'controls':['gaze_yaw','gaze_pitch','blink'],'facial_ready':False,'lip_sync_ready':False,'production_approved':False,'eye_centers':[list(c) for c in centers]}
(out/'eye_authoring_report.json').write_text(json.dumps(report,indent=2))
for frame,name in [(1,'neutral'),(9,'gaze'),(18,'blink')]:
    # A fresh render dependency graph avoids cached driver states after a
    # manual render in this authoring session. Reopen the same packed asset.
    expression=("import bpy; s=bpy.context.scene; "
        "r=next(o for o in s.objects if o.type=='ARMATURE'); "
        f"s.frame_set({frame}); r.update_tag(refresh={{'OBJECT'}}); "
        "bpy.context.view_layer.update(); "
        f"s.render.filepath={str(out/('mark_eye_'+name+'.png'))!r}; "
        "bpy.ops.render.render(write_still=True)")
    subprocess.run([bpy.app.binary_path,'-b','-t','2',str(out/'CHAR_MARK_EYE_DRAFT.blend'),
                    '--python-expr',expression],check=True)
