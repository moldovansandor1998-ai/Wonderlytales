"""Original Titokvaros development assets, generated Rigify IK/FK, editable meshes.

Blender 4.5.3 --background --python build_native.py -- --out data/titokvaros
No import from the archived animation_system. This is a development candidate,
not a claim that programmatic meshes meet feature-film quality.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
FPS = 24
random.seed(731)


def active(obj):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def material(name, color, rough=.5, metal=0, noise=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    n = m.node_tree.nodes
    p = n.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if noise:
        t = n.new('ShaderNodeTexNoise'); t.inputs['Scale'].default_value = noise
        t.inputs['Detail'].default_value = 3
        b = n.new('ShaderNodeBump'); b.inputs['Strength'].default_value = .18
        b.inputs['Distance'].default_value = .004
        m.node_tree.links.new(t.outputs['Fac'], b.inputs['Height'])
        m.node_tree.links.new(b.outputs['Normal'], p.inputs['Normal'])
    return m


def mesh(name, verts, faces, mat, sub=0):
    d = bpy.data.meshes.new(name); d.from_pydata(verts, [], faces); d.update()
    o = bpy.data.objects.new(name, d); bpy.context.collection.objects.link(o)
    if mat: d.materials.append(mat)
    for p in d.polygons: p.use_smooth = True
    if sub:
        mod = o.modifiers.new('Subdivision', 'SUBSURF'); mod.levels = sub
    return o


def ellipsoid(name, loc, scale, mat, seg=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o


def cube(name, loc, scale, mat, bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:o.data.materials.append(mat)
    if bevel:
        b=o.modifiers.new('Soft machined edges','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def curve(name, points, radius, mat):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2
    d.bevel_depth=radius;d.bevel_resolution=2
    s=d.splines.new('POLY');s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    if mat:d.materials.append(mat)
    return o


def bind(obj, rig, bone):
    """Rigid parts use an armature modifier too; mesh space is preserved."""
    if obj.type!='MESH':
        active(obj);bpy.ops.object.convert(target='MESH')
    mat=obj.matrix_world.copy()
    obj.parent=rig;obj.matrix_world=mat
    g=obj.vertex_groups.new(name=bone);g.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    mod=obj.modifiers.new('Rigify deformation','ARMATURE');mod.object=rig
    return obj


def weighted(obj,rig,bones):
    """Distance to explicit anatomical chains; unrelated limbs cannot attract skin."""
    mat=obj.matrix_world.copy();obj.parent=rig;obj.matrix_world=mat
    groups={n:obj.vertex_groups.new(name=n) for n in bones}
    for v in obj.data.vertices:
        co=obj.matrix_world@v.co
        ds=[]
        for n in bones:
            b=rig.data.bones[n];a=b.head_local;delta=b.tail_local-a
            t=max(0,min(1,(co-a).dot(delta)/max(delta.length_squared,1e-9)))
            ds.append((max(.015,(co-a-delta*t).length),n))
        ds.sort();chosen=ds[:2];vals=[d**-4 for d,n in chosen];total=sum(vals)
        for (_,n),w in zip(chosen,vals):groups[n].add([v.index],w/total,'REPLACE')
    m=obj.modifiers.new('Rigify deformation','ARMATURE');m.object=rig
    # Deform before subdivision.
    active(obj);bpy.ops.object.modifier_move_up(modifier=m.name)
    return obj


def tube(name, nodes, mat, sections=24, sub=1):
    # nodes: (x,y,z,rx,ry), ring normals in XY; useful for torso and legs.
    vs=[];fs=[]
    for x,y,z,rx,ry in nodes:
        vs += [(x+rx*math.cos(2*math.pi*i/sections),y+ry*math.sin(2*math.pi*i/sections),z) for i in range(sections)]
    for j in range(len(nodes)-1):
        for i in range(sections):
            a=j*sections+i;b=j*sections+(i+1)%sections
            fs.append((a,b,b+sections,a+sections))
    fs += [tuple(reversed(range(sections))),tuple((len(nodes)-1)*sections+i for i in range(sections))]
    return mesh(name,vs,fs,mat,sub)


def bone_tube(name, a, b, ra, rb, mat):
    a,b=Vector(a),Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,1,0))).normalized();v=d.cross(u)
    vs=[];fs=[];N=16
    for t,r in [(0,ra*.72),(.07,ra),(.32,ra),(.68,rb),(1,rb*.8)]:
        c=a.lerp(b,t)
        vs.extend([tuple(c+r*(math.cos(i*math.tau/N)*u+math.sin(i*math.tau/N)*v)) for i in range(N)])
    for j in range(4):
        for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
    fs += [tuple(reversed(range(N))),tuple(4*N+i for i in range(N))]
    return mesh(name,vs,fs,mat,1)


def remap_z(z):
    src=[0,.0852,.5372,1.072,1.2929,1.4657,1.6582,1.7197,1.95]
    dst=[0,.13,.43,.78,.96,1.13,1.28,1.34,1.7]
    for i in range(len(src)-1):
        if z<=src[i+1]:return dst[i]+(z-src[i])/(src[i+1]-src[i])*(dst[i+1]-dst[i])
    return dst[-1]+z-src[-1]


def rigify_body(code,width):
    bpy.ops.preferences.addon_enable(module='rigify')
    from rigify.metarigs.Basic import basic_human
    bpy.ops.object.armature_add()
    meta=bpy.context.object;meta.name=code+'_METARIG'
    bpy.ops.object.mode_set(mode='EDIT');meta.data.edit_bones.remove(meta.data.edit_bones[0]);bpy.ops.object.mode_set(mode='OBJECT')
    basic_human.create(meta)
    if meta.mode!='EDIT':bpy.ops.object.mode_set(mode='EDIT')
    # Connected edit-bone endpoints share updates. Snapshot the entire skeleton
    # before remapping: modifying live endpoints multiplies connected joints.
    original={b.name:(b.head.copy(),b.tail.copy()) for b in meta.data.edit_bones}
    for b in meta.data.edit_bones:
        a,z=original[b.name]
        b.head=(a.x*width,a.y,remap_z(a.z))
        b.tail=(z.x*width,z.y,remap_z(z.z))
    # Additional anatomy belongs to this new metarig, not a patched old rig.
    extras=[]
    for side,s in [('L',1),('R',-1)]:
        n='ear.'+side;b=meta.data.edit_bones.new(n);b.head=(s*.15,0,1.69);b.tail=(s*.23,0,1.88 if code=='KIPP' else 1.78);b.parent=meta.data.edit_bones['spine.006'];extras.append(n)
        n='eye.'+side;b=meta.data.edit_bones.new(n);b.head=(s*.102,-.187,1.624);b.tail=(s*.102,-.3,1.624);b.parent=meta.data.edit_bones['spine.006'];extras.append(n)
    finger_roots=[]
    for side,sgn in [('L',1),('R',-1)]:
        hand=meta.data.edit_bones['hand.'+side]
        direction=(hand.tail-hand.head).normalized()
        for i,finger in enumerate(['thumb','index','middle','ring','pinky']):
            start=hand.tail.copy()+Vector((0,(i-2)*.022,0))
            if i==0:start=hand.head.lerp(hand.tail,.38)+Vector((0,-.055,0))
            axis=(direction+Vector((0,-.75 if i==0 else 0,0))).normalized()
            length=(.07 if i==0 else .105)
            if code=='KIPP' and i>0:length=[0,.42,.51,.46,.36][i]
            parent='hand.'+side
            for j in range(3):
                name=f'f_{finger}.{j+1:02}.{side}';b=meta.data.edit_bones.new(name)
                b.head=start+axis*(length*j/3);b.tail=start+axis*(length*(j+1)/3)
                b.parent=meta.data.edit_bones[parent];b.use_connect=j>0;parent=name
                if j==0:finger_roots.append(name)
    if code!='KIPP':
        last='spine'
        for i in range(4):
            n=f'tail.{i:02}';b=meta.data.edit_bones.new(n)
            b.head=(0,.08+i*.13,.81-i*.11);b.tail=(0,.21+i*.13,.70-i*.11)
            b.parent=meta.data.edit_bones[last];last=n;extras.append(n)
    bpy.ops.object.mode_set(mode='OBJECT')
    for n in extras:meta.pose.bones[n].rigify_type='basic.super_copy'
    for n in finger_roots:meta.pose.bones[n].rigify_type='limbs.super_finger'
    active(meta);bpy.ops.pose.rigify_generate()
    rig=bpy.context.object;rig.name='TV_CHAR_'+code+'_RIG'
    meta.hide_render=True;meta.hide_set(True)
    rig['series']='TITOKVAROS';rig['asset_version']=1;rig['production_approved']=False
    for pb in rig.pose.bones:pb.rotation_mode='XYZ'
    return rig,meta


def fur_head(name,center,scale,mat,rig,bone,amount=3500):
    rng=random.Random(name);d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=.00075;d.bevel_resolution=0;d.resolution_u=1
    for _ in range(amount):
        z=rng.uniform(-.85,1);a=rng.uniform(0,math.tau);r=math.sqrt(1-z*z);normal=Vector((r*math.cos(a),r*math.sin(a),z))
        # Keep the facial mask, lips, and eyes clear for correct expression.
        if normal.y<-.38 and normal.z<.55:continue
        p=Vector(center)+Vector((normal.x*scale[0],normal.y*scale[1],normal.z*scale[2]))
        length=rng.uniform(.005,.012);tangent=Vector((normal.x*.25,.28,-.42))*length
        s=d.splines.new('POLY');s.points.add(2)
        for q,co in zip(s.points,[p,p+normal*length*.6+tangent*.2,p+normal*length+tangent]):q.co=(*co,1)
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);d.materials.append(mat)
    return bind(o,rig,bone)


def facial_mouth(code,rig,cream,dark):
    # Connected annular lip surface, with dedicated cavity and oral interior.
    # Shapes preserve topology; jaw-open is not a random skin displacement.
    N=48;vs=[];fs=[]
    for rx,rz,y in [(.14,.057,-.273),(.126,.044,-.321),(.106,.028,-.331),(.098,.023,-.300)]:
        vs += [(rx*math.cos(i*math.tau/N),y,1.452+rz*math.sin(i*math.tau/N)) for i in range(N)]
    for j in range(3):
        for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
    lip=mesh(code+'_ORAL_RING',vs,fs,cream,1);bind(lip,rig,'DEF-spine.006')
    lip.shape_key_add(name='Basis')
    shapes={}
    for key in ['jawOpen','mouthSmile','mouthFrown','viseme_A','viseme_E','viseme_O','viseme_U','viseme_MBP','viseme_FV']:
        k=lip.shape_key_add(name=key);shapes[key]=k
        for i,p in enumerate(k.data):
            x,y,z=vs[i];side=abs(x)/.14
            if key in ['jawOpen','viseme_A']:p.co.z-=max(0,(1.46-z)/.065)*.08
            if key=='mouthSmile':p.co.z+=side**2*.035
            if key=='mouthFrown':p.co.z-=side**2*.025
            if key=='viseme_E':p.co.x*=1.12;p.co.z=1.452+(z-1.452)*.7
            if key in ['viseme_O','viseme_U']:p.co.x*=.55;p.co.y-=.018;p.co.z=1.452+(z-1.452)*(1.45 if key=='viseme_O' else 1.1)
            if key=='viseme_MBP':p.co.z=1.452+(z-1.452)*.12
            if key=='viseme_FV' and z<1.452:p.co.z+=.017
    bind(ellipsoid(code+'_mouth_cavity',(0,-.286,1.438),(.107,.046,.075),dark),rig,'DEF-spine.006')
    return lip


def character(code):
    print('TV_BUILD_CHARACTER '+code,flush=True)
    wide={'MIRA':1.35,'BRUNO':1.9,'KIPP':1.1}[code]
    rig,meta=rigify_body(code,wide)
    fur=material(code+'_fur', {'MIRA':(.12,.059,.026),'BRUNO':(.25,.255,.25),'KIPP':(.24,.095,.037)}[code],noise=110)
    cream=material(code+'_cream',(.66,.54,.36),noise=100)
    if code=='BRUNO':cream=material(code+'_ivory',(.72,.7,.60),noise=110)
    dark=material(code+'_charcoal',(.025,.016,.016),.52)
    cloth=material(code+'_cloth',{'MIRA':(.49,.25,.047),'BRUNO':(.035,.064,.115),'KIPP':(.16,.29,.205)}[code],noise=190)
    pants=material(code+'_trousers',(.028,.066,.077),noise=200)
    leather=material(code+'_leather',(.062,.034,.020),.55,noise=60)
    brass=material(code+'_brass',(.45,.26,.07),.35,.7)
    eye=material(code+'_sclera',(.68,.61,.43),.25)
    iris=material(code+'_iris',(.27,.12,.022),.24)
    headbone='DEF-spine.006';torso=['DEF-spine','DEF-spine.001','DEF-spine.002','DEF-spine.003']
    w={'MIRA':.22,'BRUNO':.32,'KIPP':.19}[code]
    body=tube(code+'_COAT',[(0,0,.72,w*.95,.15),(0,0,.78,w,.17),(0,0,.94,w*.93,.17),(0,0,1.12,w*1.05,.18),(0,0,1.21,w*.85,.15),(0,0,1.28,.10,.10)],cloth)
    weighted(body,rig,torso)
    bind(ellipsoid(code+'_neck',(0,0,1.32),(.1,.095,.15),fur),rig,'DEF-spine.005')
    hs=(.24 if code!='BRUNO' else .27,.205,.245)
    bind(ellipsoid(code+'_HEAD',(0,-.004,1.536),hs,fur,48,32),rig,headbone)
    fur_head(code+'_groom',(0,-.004,1.536),hs,fur,rig,headbone)
    # Eye surfaces and continuous lids, independently addressable gaze and blink.
    eyes=[]
    for side,s in [('L',1),('R',-1)]:
        x=s*.102
        bind(ellipsoid(code+'_cheek_'+side,(s*.088,-.187,1.494),(.112,.105,.085),cream),rig,headbone)
        if code=='BRUNO':
            patch=ellipsoid(code+'_stripe_'+side,(x,-.163,1.62),(.071,.06,.151),dark)
            patch.rotation_euler[1]=s*.15;bind(patch,rig,headbone)
        eyebone='DEF-eye.'+side
        bind(ellipsoid(code+'_eye_'+side,(x,-.187,1.624),(.069,.044,.072),eye),rig,eyebone)
        pupil=ellipsoid(code+'_iris_'+side,(x,-.227,1.623),(.044,.014,.046),iris);bind(pupil,rig,eyebone)
        bind(ellipsoid(code+'_pupil_'+side,(x,-.239,1.623),(.024,.008,.031),dark),rig,eyebone)
        bind(ellipsoid(code+'_glint_'+side,(x-.012,-.247,1.644),(.009,.003,.009),material(code+'_glint_'+side,(1,.95,.78),.1)),rig,eyebone)
        # Upper lid is a hemisphere ribbon whose inner boundary closes over globe.
        N=28;vs=[];closed=[];fs=[]
        for row in range(4):
            for i in range(N+1):
                theta=math.pi*i/N;rad=.071+row*.008
                xx=x+math.cos(theta)*rad;zz=1.623+math.sin(theta)*rad
                yy=-.206-row*.0005
                vs.append((xx,yy,zz))
                closed.append((xx,yy-(.048 if row<2 else .012),zz-(math.sin(theta)*(.123 if row<2 else .065))))
        for r in range(3):
            for i in range(N):a=r*(N+1)+i;fs.append((a,a+1,a+N+2,a+N+1))
        lid=mesh(code+'_lid_'+side,vs,fs,fur,1);bind(lid,rig,headbone)
        lid.shape_key_add(name='Basis');k=lid.shape_key_add(name='blink')
        for p,c in zip(k.data,closed):p.co=c
        eyes.append(lid)
        brow=curve(code+'_brow_'+side,[(x-.063,-.211,1.704),(x,-.232,1.722),(x+.063,-.205,1.700)],.013,fur);bind(brow,rig,headbone)
        eh=.17 if code=='KIPP' else .069
        ew=.08 if code=='KIPP' else .067
        ear=ellipsoid(code+'_ear_'+side,(s*.193,.005,1.747 if code!='KIPP' else 1.807),(ew,.05,eh),fur)
        ear.rotation_euler[1]=s*.32;bind(ear,rig,'DEF-ear.'+side)
        earin=ellipsoid(code+'_ear_inner_'+side,(s*.197,-.039,1.749 if code!='KIPP' else 1.809),(ew*.66,.013,eh*.7),material(code+'_ear_skin_'+side,(.31,.12,.075),.6))
        earin.rotation_euler[1]=s*.32;bind(earin,rig,'DEF-ear.'+side)
        # Continuous limb meshes, no detached ball joints.
        for label,mt,r in [('upper_arm',cloth,.087),('forearm',fur if code=='KIPP' else cloth,.068)]:
            b=rig.data.bones['ORG-'+label+'.'+side]
            o=bone_tube(code+'_'+label+'_'+side,b.head_local,b.tail_local,r*(1.3 if code=='BRUNO' else 1),r*.85,mt)
            weighted(o,rig,['DEF-'+label+'.'+side,'DEF-'+label+'.'+side+'.001'])
        hb=rig.data.bones['ORG-hand.'+side]
        palm=bone_tube(code+'_hand_'+side,hb.head_local,hb.tail_local,.051,.035,fur);bind(palm,rig,'DEF-hand.'+side)
        for digit in ['thumb','index','middle','ring','pinky']:
            for i in range(1,4):
                bn=f'DEF-f_{digit}.{i:02}.{side}';bb=rig.data.bones[bn]
                ob=bone_tube(code+f'_{digit}_{side}_{i}',bb.head_local,bb.tail_local,.012,.010,fur)
                bind(ob,rig,bn)
        for label,r in [('thigh',.11),('shin',.077)]:
            b=rig.data.bones['ORG-'+label+'.'+side]
            o=bone_tube(code+'_'+label+'_'+side,b.head_local,b.tail_local,r*(1.35 if code=='BRUNO' else 1),r*.82,pants if code!='BRUNO' else cloth)
            weighted(o,rig,['DEF-'+label+'.'+side,'DEF-'+label+'.'+side+'.001'])
        b=rig.data.bones['ORG-foot.'+side]
        shoe=ellipsoid(code+'_boot_'+side,(b.head_local.x,-.065,.099),(.09,.171,.084),leather);bind(shoe,rig,'DEF-foot.'+side)
        sole=cube(code+'_sole_'+side,(b.head_local.x,-.065,.043),(.179,.292,.045),dark,.018);bind(sole,rig,'DEF-foot.'+side)
        for j in range(3):bind(curve(code+'_lace_'+side+str(j),[(b.head_local.x-.05,-.083-j*.024,.159),(b.head_local.x+.05,-.085-j*.024,.159)],.0035,cream),rig,'DEF-foot.'+side)
    # Nose and lip rig are geometry with separate controllers, not an audio amplitude scale.
    nose=ellipsoid(code+'_nose',(0,-.300,1.521),(.045,.035,.026),dark);bind(nose,rig,headbone)
    mouth=facial_mouth(code,rig,cream,dark)
    for s in [-1,1]:
        for j in range(3):bind(curve(code+f'_whisker_{s}_{j}',[(s*.066,-.278,1.505-j*.012),(s*.16,-.299,1.51-j*.019),(s*.238,-.28,1.53-j*.025)],.00085,cream),rig,headbone)
    # Sewn trims and buttons distinguish costumes even in silhouette.
    for z in [.82,.93,1.04,1.15]:bind(ellipsoid(code+'_button_'+str(z),(0,-.18,z),(.010,.007,.010),brass,12,8),rig,'DEF-spine.002')
    for s in [-1,1]:
        pocket=cube(code+'_pocket_'+str(s),(s*w*.61,-.156,.855),(w*.60,.037,.13),cloth,.01);bind(pocket,rig,'DEF-spine.001')
    if code!='KIPP':
        ns=[]
        for i in range(9):t=i/8;ns.append((0,.10+t*.53,.79-t*.44,.095*(1-t)+.011,.08*(1-t)+.01))
        weighted(tube(code+'_TAIL',ns,fur,20,2),rig,['DEF-tail.'+str(i).zfill(2) for i in range(4)])
    else:
        membrane=material('KIPP_wing_membrane',(.11,.045,.028),.7,noise=75)
        # Rest membrane connects forearm to flank. Dedicated deform binding;
        # folding and the full wing finger rig must pass anatomical review.
        for side,s in [('L',1),('R',-1)]:
            hb=rig.data.bones['ORG-hand.'+side].head_local
            vs=[tuple(hb),(s*.39,.04,.94),(s*.30,.06,.76),(s*.14,.07,.83),(s*.16,.06,1.08)]
            wing=mesh('KIPP_membrane_'+side,vs,[(0,1,2,3,4)],membrane,0)
            mod=wing.modifiers.new('Membrane thickness','SOLIDIFY');mod.thickness=.002
            weighted(wing,rig,['DEF-forearm.'+side,'DEF-spine.002'])
    # Scale in object space only after all bind coordinates are established.
    scale={'MIRA':1.0,'BRUNO':1.05,'KIPP':.80}[code]
    rig.scale=(scale,)*3
    for side in ['L','R']:
        rig.pose.bones['upper_arm_parent.'+side]['IK_FK']=1.0
    return {'rig':rig,'meta':meta,'mouth':mouth,'lids':eyes,'scale':scale}


def look_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def light(name,loc,power,color,size,target):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;look_at(o,target);return o


def stage_city():
    stone=material('city limestone',(.24,.23,.205),noise=55)
    road=material('wet basalt',(.045,.067,.070),.29,noise=65)
    copper=material('aged copper',(.10,.24,.20),.38,.65)
    trim=material('cream cornice',(.49,.42,.29),.6,noise=90)
    iron=material('dark iron',(.028,.055,.057),.36,.6)
    window=material('warm windows',(1,.51,.13),.3)
    p=window.node_tree.nodes.get('Principled BSDF');p.inputs['Emission Color'].default_value=(1,.43,.08,1);p.inputs['Emission Strength'].default_value=1.7
    cube('TV_ENV_REZRAKPART_ground',(0,1,-.18),(65,65,.35),road,.05)
    for side in [-1,1]:
        cube('quay_paving',(side*6,2,.02),(4,55,.18),stone,.02)
        for j in range(32):
            cube('paving_joint',(side*6,-23+j*1.6,.114),(4,.015,.007),iron,0)
    for x in [-1.15,-.91,1.0,1.24]:cube('tram_rail',(x,3,.013),(.045,60,.033),copper,.005)
    for y in range(-14,25,5):
        for side in [-1,1]:
            x=side*4.7
            curve('lamp post',[(x,y,.1),(x,y,3.9),(x-side*.5,y,4.2)],.045,iron)
            cube('lantern',(x-side*.5,y,3.93),(.28,.28,.44),copper,.03)
            cube('lantern_glow',(x-side*.5,y-.15,3.93),(.20,.02,.31),window,.012)
    palette=[(.31,.12,.062),(.14,.24,.24),(.40,.30,.17),(.25,.17,.24),(.30,.35,.27)]
    for side in [-1,1]:
        for j in range(8):
            x=side*(10+random.uniform(-.8,.8));y=-13+j*6.4;h=random.uniform(7,12)
            facade=material(f'facade_{side}_{j}',palette[j%5],noise=40)
            cube('townhouse',(x,y,h/2),(5.8,5.9,h),facade,.12)
            cube('roof_cornice',(x,y,h),(6.05,6.13,.27),trim,.08)
            for z in [2.0,4.5,7.,9.5]:
                if z>h-1:continue
                cube('floor_cornice',(x-side*2.96,y,z-.6),(.16,5.96,.15),trim,.03)
                for off in [-1.75,0,1.75]:
                    cube('window_recess',(x-side*2.94,y+off,z),(.12,.88,1.46),iron,.035)
                    cube('window_pane',(x-side*3.015,y+off,z),(.02,.68,1.22),window,.01)
                    cube('window_sill',(x-side*3.03,y+off,z-.68),(.30,1.07,.11),trim,.02)
                    cube('window_bar',(x-side*3.045,y+off,z),(.025,.04,1.24),copper,.008)
    # Skyline and elevated crossing remain geometrical across every camera.
    for j in range(15):
        x=-25+j*3.6;h=random.uniform(15,28)
        cube('skyline',(x,38,h/2),(2.5,3.7,h),iron,.10)
        for z in range(2,int(h),2):
            for off in [-.65,0,.65]:cube('skyline_lit',(x+off,36.13,z),(.22,.02,.6),window,.01)
    cube('elevated_tram_deck',(0,19,5.7),(38,3,.60),stone,.1)
    for x in [-14,-7,0,7,14]:
        cube('viaduct_pier',(x,19,2.7),(.9,1.3,5.5),stone,.10)
        # Arch-shaped ribs leave open ground-level sightlines.
        pts=[(x+3.5+3.0*math.cos(t*math.pi/24),17.42,2.6+2.7*math.sin(t*math.pi/24)) for t in range(25)]
        curve('viaduct_arch',pts,.22,trim)
    return {'stone':stone,'road':road,'copper':copper,'trim':trim,'iron':iron,'window':window}


def setup_render():
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
    s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.render.fps=24
    s.world=bpy.data.worlds.new('TV_WORLD_blue_hour');s.world.color=(.10,.10,.10);s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.23,.34,1)
    s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
    s.view_settings.view_transform='AgX'
    light('warm key',(-3,-5,7),1500,(1,.74,.45),5,(0,0,1))
    light('sky fill',(4,-1,6),1200,(.41,.64,1),6,(0,0,1))
    light('copper rim',(0,5,5),1800,(1,.49,.16),4,(0,0,1))
    bpy.ops.object.camera_add(location=(4,-8,3));cam=bpy.context.object;cam.name='TV_CAM_master';cam.data.lens=50;look_at(cam,(0,0,1.1));s.camera=cam
    return cam


def pose_rest(c):
    r=c['rig']
    # Lower arms from Rigify's authored A-pose into a natural relaxed stance.
    for side,sgn in [('L',1),('R',-1)]:
        r.pose.bones['upper_arm_fk.'+side].rotation_euler[1]=sgn*0.08
        r.pose.bones['upper_arm_fk.'+side].rotation_euler[2]=sgn*.31
        r.pose.bones['forearm_fk.'+side].rotation_euler[0]=-.10


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--proof',action='store_true')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cast={code:character(code) for code in ['MIRA','BRUNO','KIPP']}
    for code,c in cast.items():
        c['rig'].location.x={'MIRA':-1.05,'BRUNO':.55,'KIPP':1.9}[code];pose_rest(c)
    print('TV_BUILD_CITY',flush=True)
    stage_city();cam=setup_render();cam.location=(3.3,-7.8,2.55);look_at(cam,(.35,0,1.02));cam.data.lens=50
    s=bpy.context.scene;s.frame_start=1;s.frame_end=1152;s['series']='TITOKVAROS';s['production_approved']=False
    s['review_stage']='MODEL_AND_RIG_DEVELOPMENT';s['source_contract']='TV_V001'
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'TV_MASTER_V001.blend'))
    report={'blender':bpy.app.version_string,'frames':1152,'fps':24,'production_approved':False,'cast':{}}
    for code,c in cast.items():
        r=c['rig'];report['cast'][code]={'bones':len(r.data.bones),'rigify':bool(r.data.get('rig_id')),'controls':list(r.pose.bones.keys()),'mouth_shapes':list(c['mouth'].data.shape_keys.key_blocks.keys()),'meshes':len([o for o in bpy.data.objects if o.parent==r]),'known_incomplete':['finger articulation','facial seam review','wing anatomical review' if code=='KIPP' else 'gait acting review']}
    (out/'asset_audit.json').write_text(json.dumps(report,indent=2))
    if a.proof:
        s.render.filepath=str(out/'TV_model_proof_V001.png');bpy.ops.render.render(write_still=True)
    print('TV_BUILD_COMPLETE '+str(out),flush=True)


if __name__=='__main__':main()
