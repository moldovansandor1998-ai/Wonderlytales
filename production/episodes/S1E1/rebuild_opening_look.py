"""Native first-scene woodland look development."""
import bpy, bmesh, math, random, json, sys
from pathlib import Path
from mathutils import Vector, Euler

root=Path(sys.argv[sys.argv.index('--')+1]);out=Path(sys.argv[sys.argv.index('--')+2]);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(root/'episode-v017/S1E1_SC001_NATIVE_ACTING_V017.blend'))
s=bpy.context.scene;random.seed(18017)

def mesh(name,vs,fs,materials,indices=None):
    data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update()
    for m in materials:data.materials.append(m)
    for i,p in enumerate(data.polygons):
        p.use_smooth=True
        if indices:p.material_index=indices[i]
    o=bpy.data.objects.new(name,data);s.collection.objects.link(o);return o

def material(name,color,rough=.7,noise=8,bump=.1):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;bs=n.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=rough
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=noise;tex.inputs['Detail'].default_value=3
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=tuple(c*.65 for c in color)+(1,);ramp.color_ramp.elements[1].color=color+(1,)
    l.new(tex.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],bs.inputs['Base Color'])
    b=n.new('ShaderNodeBump');b.inputs['Strength'].default_value=bump;b.inputs['Distance'].default_value=.018
    l.new(tex.outputs['Fac'],b.inputs['Height']);l.new(b.outputs['Normal'],bs.inputs['Normal']);return m

def ground(x,y):
    t=max(0,min(1,(y-12)/48));ridge=t*t*(3-2*t)*(2.6+.9*math.sin(x*.18)+.5*math.sin(y*.22))
    return .035*math.sin(x*.6)*math.cos(y*.7)+.009*x+ridge

# Continuous soil/path shader eliminates the raised ribbon and hard seams.
bpy.data.objects['Uneven forest floor'].hide_render=True;bpy.data.objects['Winding forest path'].hide_render=True
terrain_vs=[(x,y,ground(x,y)) for y in range(-12,61) for x in range(-30,31)]
terrain_fs=[(j*61+i,j*61+i+1,(j+1)*61+i+1,(j+1)*61+i) for j in range(72) for i in range(60)]
floor=mesh('V018 continuous woodland terrain',terrain_vs,terrain_fs,[])
soil=material('V018 continuous moss and woodland soil',(.19,.14,.075),noise=14,bump=.28)
n=soil.node_tree.nodes;l=soil.node_tree.links;bs=n.get('Principled BSDF')
geo=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geo.outputs['Position'],sep.inputs[0])
for tex in n:
    if tex.type=='TEX_NOISE':l.new(geo.outputs['Position'],tex.inputs['Vector'])
def mathnode(op,a,b=None):
    node=n.new('ShaderNodeMath');node.operation=op
    if isinstance(a,(int,float)):node.inputs[0].default_value=a
    else:l.new(a,node.inputs[0])
    if b is not None:
        if isinstance(b,(int,float)):node.inputs[1].default_value=b
        else:l.new(b,node.inputs[1])
    return node.outputs[0]
center=mathnode('MULTIPLY',mathnode('SINE',mathnode('MULTIPLY',sep.outputs['Y'],.23)),.6)
edge=mathnode('ABSOLUTE',mathnode('SUBTRACT',sep.outputs['X'],center))
noise=n.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=3;noise.inputs['Detail'].default_value=3;l.new(geo.outputs['Position'],noise.inputs[0])
edge=mathnode('ADD',edge,mathnode('MULTIPLY',mathnode('SUBTRACT',noise.outputs['Fac'],.5),.45))
ramp=n.new('ShaderNodeValToRGB');ramp.name='V018 trail soft shoulder';ramp.color_ramp.interpolation='EASE';ramp.color_ramp.elements[0].position=.45;ramp.color_ramp.elements[0].color=(0,0,0,1);ramp.color_ramp.elements[1].position=.75;ramp.color_ramp.elements[1].color=(1,1,1,1)
mapping=n.new('ShaderNodeMapRange');mapping.inputs['From Min'].default_value=0;mapping.inputs['From Max'].default_value=2;l.new(edge,mapping.inputs['Value']);l.new(mapping.outputs['Result'],ramp.inputs[0])
pathcol=n.new('ShaderNodeValToRGB');pathcol.color_ramp.elements[0].color=(.23,.145,.07,1);pathcol.color_ramp.elements[1].color=(.40,.28,.135,1);l.new(noise.outputs['Fac'],pathcol.inputs[0])
mosscol=n.new('ShaderNodeValToRGB');mosscol.color_ramp.elements[0].color=(.055,.07,.025,1);mosscol.color_ramp.elements[1].color=(.13,.20,.04,1);l.new(noise.outputs['Fac'],mosscol.inputs[0])
mix=n.new('ShaderNodeMixRGB');l.new(ramp.outputs[0],mix.inputs[0]);l.new(pathcol.outputs[0],mix.inputs[1]);l.new(mosscol.outputs[0],mix.inputs[2]);l.new(mix.outputs[0],bs.inputs['Base Color'])
floor.data.materials.clear();floor.data.materials.append(soil)

# Keep the native trunks; replace low confetti foliage and spherical hills.
for o in list(s.objects):
    if o.name.startswith('Distant wooded hill'):o.hide_render=True
    if o.type=='MESH' and o.name.startswith('Reusable forest foliage'):
        o.data=o.data.copy();bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.delete(bm,geom=[v for v in bm.verts if (o.matrix_world@v.co).z<.7],context='VERTS');bm.to_mesh(o.data);bm.free()

greens=[material('V018 leaf '+str(i),c,rough=.5,noise=4,bump=.04) for i,c in enumerate([(.09,.24,.035),(.18,.34,.055),(.32,.43,.09)])]
bark=material('V018 young woodland bark',(.18,.105,.045),noise=22,bump=.4)
vs=[];fs=[];mi=[]
leafshape=[(0,0,0),(.08,-.035,.018),(.08,0,.038),(.08,.035,.018),(.17,-.028,.014),(.17,0,.029),(.17,.028,.014),(.24,0,0)]
leaf_faces=[(0,1,2),(0,2,3),(1,4,5,2),(2,5,6,3),(4,7,5),(5,7,6)]
def leaf(p,scale,angles,variant):
    k=len(vs);rot=Euler(angles).to_matrix();vs.extend(Vector(p)+rot@(Vector(v)*scale) for v in leafshape);fs.extend(tuple(k+i for i in f) for f in leaf_faces);mi.extend([variant]*len(leaf_faces))
def tube(name,points,radii):
    verts=[];faces=[];count=8
    for j,p in enumerate(points):
        direction=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]);direction.normalize();a=direction.cross(Vector((0,1,0)))
        if a.length<.1:a=direction.cross(Vector((1,0,0)))
        a.normalize();b=direction.cross(a)
        for i in range(count):verts.append(Vector(p)+radii[j]*(math.cos(i*math.tau/count)*a+math.sin(i*math.tau/count)*b))
    for j in range(len(points)-1):
        for i in range(count):faces.append((j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i))
    return mesh(name,verts,faces,[bark])

for index in range(85):
    x=random.uniform(-18,18);y=random.uniform(7,57)
    if abs(x)<1.9:x+=2.3 if x>0 else -2.3
    h=random.uniform(5.0,9.0);r=random.uniform(.12,.28);base_z=ground(x,y)
    tube('V018 layered woodland trunk',[(x,y,base_z),(x+.1,y,base_z+h*.5),(x-.12,y+.1,base_z+h)],[r*1.35,r,.025])
    for j in range(6):
        a=j*math.tau/6+index*.35;z=base_z+h*.52+j*.18;tip=Vector((x+math.cos(a)*1.3,y+math.sin(a)*1.3,z+.7))
        tube('V018 crown branch',[(x,y,z),((x+tip.x)/2,(y+tip.y)/2,z+.35),tip],[r*.35,r*.18,.012])
        for k in range(130):
            while True:
                delta=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-1,1)))
                if delta.length<1:break
            leaf(tip+delta*1.25,random.uniform(.8,1.6),(random.uniform(-1,1),random.uniform(-1,1),random.uniform(0,math.tau)),random.choices([0,1,2],[3,5,2])[0])
mesh('V018 detailed layered tree crowns',vs,fs,greens,mi)

# Curved blades and fern leaflets, with an open trail for character contact.
gvs=[];gfs=[];gmi=[]
for i in range(600):
    x=random.uniform(-7,7);y=random.uniform(-4,17)
    if abs(x-.6*math.sin(y*.23))<1.15:continue
    if (x+1.55)**2+(y-.9)**2<.30:continue
    for j in range(10):
        angle=random.uniform(0,math.tau);h=random.uniform(.11,.30);w=random.uniform(.012,.025);base=len(gvs)
        for k in range(5):
            t=k/4;cx=x+math.cos(angle)*h*.4*t*t;cy=y+math.sin(angle)*h*.4*t*t;z=ground(x,y)+h*t;width=w*(1-t)+.001
            gvs.extend([(cx-math.sin(angle)*width,cy+math.cos(angle)*width,z),(cx+math.sin(angle)*width,cy-math.cos(angle)*width,z)])
        for k in range(4):gfs.append((base+2*k,base+2*k+1,base+2*k+3,base+2*k+2));gmi.append(i%3)
mesh('V018 curved woodland grasses',gvs,gfs,greens,gmi)
vs=[];fs=[];mi=[]
for i in range(34):
    x=random.uniform(-4,4);y=random.uniform(-2,12)
    if abs(x-.6*math.sin(y*.23))<1.3:continue
    for j in range(7):
        a=j*math.tau/7+i;length=random.uniform(.38,.7)
        for k in range(1,10):
            t=k/10;p=Vector((x+math.cos(a)*length*t,y+math.sin(a)*length*t,ground(x,y)+.08+.4*math.sin(t*2)))
            for side in [-1,1]:leaf(p, .7*(1-t)+.15,(0,side*.35,a+side*1.15),i%3)
mesh('V018 fern understory',vs,fs,greens,mi)
vs=[];fs=[];mi=[]
for i in range(60):
    x=random.uniform(-12,12);y=random.uniform(4,40)
    if abs(x-.6*math.sin(y*.23))<1.9:continue
    radius=random.uniform(.5,.9);z=ground(x,y)+radius*.6
    for k in range(180):
        d=Vector((random.uniform(-1,1),random.uniform(-1,1),random.uniform(-.6,.6)))
        if d.length>1:continue
        leaf(Vector((x,y,z))+d*radius,random.uniform(.8,1.5),(random.uniform(-.8,.8),random.uniform(-.8,.8),random.uniform(0,math.tau)),i%3)
mesh('V018 layered woodland shrub leaves',vs,fs,greens,mi)

# A shaped, textured pebble replaces the featureless flattened sphere.
stone=bpy.data.objects['Flat stone hiding the fragment'];stone.data=stone.data.copy()
for v in stone.data.vertices:
    x,y,z=v.co;factor=1+.12*math.sin(x*7+y*4)+.07*math.cos(y*9-z*3);v.co.x*=factor;v.co.y*=factor;v.co.z*=1+.15*math.sin(x*5)
stone.scale=(.27,.18,.045);stone.location.z=.067
stone.data.materials.clear();stone.data.materials.append(material('V018 weathered warm pebble',(.29,.265,.20),noise=28,bump=.32))
for p in stone.data.polygons:p.use_smooth=True

# Stabilize the stationary lower-body pose; walking remains a review candidate.
mark=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_MARK' in o.name)
for fc in mark.animation_data.action.fcurves:
    if any('"'+name+'.' in fc.data_path for name in ['thigh','shin','foot']):
        for k in fc.keyframe_points:
            if k.co.x>=260:k.co.y=0;k.handle_left.y=0;k.handle_right.y=0
s.frame_set(301);bpy.context.view_layer.update();body=max((o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==mark for m in o.modifiers)),key=lambda o:len(o.data.vertices))
evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh();low=min((evaluated.matrix_world@v.co).z for v in data.vertices);evaluated.to_mesh_clear();pivot=mark.parent
delta=ground(pivot.location.x,pivot.location.y)+.009-low
for fc in pivot.animation_data.action.fcurves:
    if fc.data_path=='location' and fc.array_index==2:
        for k in fc.keyframe_points:k.co.y+=delta;k.handle_left.y+=delta;k.handle_right.y+=delta

# Warm directional light, cooler fill and selective camera depth.
sun=bpy.data.objects['Late afternoon sun'];sun.data.energy=3.0;sun.data.color=(1,.84,.65);sun.data.angle=.13
fill=bpy.data.objects['Soft camera fill'];fill.data.energy=350;fill.data.color=(.78,.88,1);fill.data.size=6;fill.location=(-3,-4,5);fill.rotation_euler=(Vector((-.7,1,1))-fill.location).to_track_quat('-Z','Y').to_euler()
rimdata=bpy.data.lights.new('V018 warm canopy bounce','AREA');rimdata.energy=220;rimdata.color=(1,.75,.40);rimdata.shape='DISK';rimdata.size=4
rim=bpy.data.objects.new('V018 warm canopy bounce',rimdata);s.collection.objects.link(rim);rim.location=(2,4,5);rim.rotation_euler=(Vector((-.7,1,1))-rim.location).to_track_quat('-Z','Y').to_euler()
s.world.node_tree.nodes['Background'].inputs[0].default_value=(.31,.46,.63,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.3
bpy.ops.mesh.primitive_cube_add(size=2,location=(0,31,7));atmosphere=bpy.context.object;atmosphere.name='V018 distant woodland atmosphere';atmosphere.scale=(24,27,8)
mist=bpy.data.materials.new('V018 gentle woodland haze');mist.use_nodes=True;nodes=mist.node_tree.nodes;nodes.clear();volume=nodes.new('ShaderNodeVolumePrincipled');volume.inputs['Density'].default_value=.008;volume.inputs['Color'].default_value=(.7,.82,.9,1);volume.inputs['Anisotropy'].default_value=.35;output=nodes.new('ShaderNodeOutputMaterial');mist.node_tree.links.new(volume.outputs['Volume'],output.inputs['Volume']);atmosphere.data.materials.append(mist)
s.view_settings.exposure=.35
fox=next(o for o in s.objects if o.type=='ARMATURE' and 'CHAR_LILI' in o.name)
s.frame_set(301);bpy.context.view_layer.update();fox_body=max((o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==fox for m in o.modifiers)),key=lambda o:len(o.data.vertices))
evaluated=fox_body.evaluated_get(bpy.context.evaluated_depsgraph_get());data=evaluated.to_mesh();fox_low=min((evaluated.matrix_world@v.co).z for v in data.vertices);evaluated.to_mesh_clear();fox_pivot=fox.parent
fox_delta=ground(fox_pivot.location.x,fox_pivot.location.y)+.009-fox_low
for fc in fox_pivot.animation_data.action.fcurves:
    if fc.data_path=='location' and fc.array_index==2:
        for k in fc.keyframe_points:k.co.y+=fox_delta;k.handle_left.y+=fox_delta;k.handle_right.y+=fox_delta
focus={}
for code in ['mark','fox','pair']:
    o=bpy.data.objects.new('V018 focus '+code,None);s.collection.objects.link(o);focus[code]=o
for f in range(1,1602,4):
    s.frame_set(f);mp=mark.matrix_world@mark.pose.bones['head'].head+Vector((0,0,.12));fp=fox.matrix_world@fox.pose.bones['head'].head+Vector((0,0,.05))
    for code,pos in [('mark',mp),('fox',fp),('pair',(mp+fp)/2)]:focus[code].location=pos;focus[code].keyframe_insert('location',frame=f)
for marker in s.timeline_markers:
    cam=marker.camera
    if not cam:continue
    cam.data.dof.use_dof=True;cam.data.dof.aperture_fstop=5.6
    if 'fragment' in cam.name.lower():cam.data.dof.focus_object=bpy.data.objects['Story star fragment under the stone'];cam.data.dof.aperture_fstop=8
    elif 'Leaf lifts' in cam.name:cam.data.dof.focus_object=bpy.data.objects['Leaf lifted by the signal'];cam.data.dof.aperture_fstop=8
    else:cam.data.dof.focus_object=focus['fox' if cam.name.startswith('Lili') else 'mark' if cam.name.startswith('Mark') else 'pair']
s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=True;s.cycles.max_bounces=5;s.cycles.volume_bounces=1;s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=100;s.render.use_sequencer=False;s.render.use_persistent_data=True
s['status']='V018_FIRST_SCENE_LOOKDEV_NOT_APPROVED';s['episode_finished']=False
bpy.ops.file.pack_all();s.frame_set(889);bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_SC001_LOOKDEV_V018.blend'),compress=True)
report={'status':'LOOKDEV_NOT_FINAL_ANIMATION','spherical_hills_removed':True,'continuous_ground_shader':True,'terrain_extended_to_background_tree_roots':True,'new_layered_background_trees':85,'layered_shrubs_and_volumetric_atmosphere':True,'stationary_mark_ground_offset_m':delta,'stationary_fox_ground_offset_m':fox_delta,'full_episode_finished':False,'walking_and_facial_approved':False}
(out/'V018_lookdev_QC.json').write_text(json.dumps(report,indent=2))
for f in [889,1251]:
    s.frame_set(f);s.render.filepath=str(out/f'SC001_V018_{f:04}.png');bpy.ops.render.render(write_still=True)
print('LOOKDEV_COMPLETE',flush=True)
