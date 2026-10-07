"""Deterministic draft character masters and forest set; no generated identities."""
import math, random, os
import bpy
from mathutils import Vector

PALETTE={}
def mat(name, color, rough=.65, emission=0):
    if name in PALETTE:return PALETTE[name]
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    PALETTE[name]=m;return m

def ell(name, p, s, material, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.data.materials.append(material)
    for f in o.data.polygons:f.use_smooth=True
    if parent:o.parent=parent
    return o

def pivot(name,p,parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=p;o.parent=parent;return o

def line(name,points,r,material,parent=None):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
    sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for b,p in zip(sp.bezier_points,points):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);o.parent=parent;return o

def eyes(head,z=.05,width=.19,y=-.35):
    white=mat('ivory',(1,.94,.8));iris=mat('iris',(.12,.28,.22));black=mat('pupil',(.017,.025,.034),.2)
    lids=[]
    for x in [-width,width]:
        lid=pivot('blink',(x,y,z),head);lids.append(lid)
        ell('eye white',(0,0,0),(.115,.067,.14),white,lid)
        ell('iris',(0,-.061,-.005),(.065,.025,.088),iris,lid)
        ell('pupil',(0,-.083,-.005),(.032,.013,.052),black,lid)
        ell('catchlight',(-.02,-.095,.026),(.018,.008,.022),white,lid)
    return lids

def character(code,location):
    root=pivot(code+'_DRAFT_V002',location)
    skin=mat('skin',(.77,.44,.26));red=mat('hoodie',(.65,.045,.048));hair=mat('hair',(.13,.052,.024));blue=mat('denim',(.055,.15,.25));cream=mat('cream',(.95,.83,.63));dark=mat('nose',(.035,.025,.025),.25)
    limbs=[];lids=[];tail=None
    if code=='CHAR_MARK':
        ell('hoodie',(0,0,1.03),(.32,.23,.42),red,root)
        ell('hood', (0,.105,1.38),(.33,.24,.20),red,root)
        line('zipper',[(0,-.23,.82),(0,-.244,1.28)],.013,cream,root)
        ell('pocket',(0,-.22,.88),(.20,.035,.11),red,root)
        for x in [-.13,.13]:
            leg=pivot('hip',(x,0,.73),root);limbs.append(leg)
            ell('trouser',(0,0,-.24),(.115,.13,.29),blue,leg)
            ell('sneaker',(0,-.065,-.61),(.13,.22,.11),cream,leg)
            ell('shoe stripe',(0,-.14,-.63),(.135,.14,.032),red,leg)
        for x in [-.31,.31]:
            arm=pivot('shoulder',(x,0,1.30),root);limbs.append(arm)
            ell('sleeve',(0,0,-.21),(.105,.115,.27),red,arm)
            ell('hand',(0,-.005,-.46),(.09,.085,.12),skin,arm)
        head=pivot('head',(0,0,1.68),root)
        ell('face',(0,0,0),(.36,.30,.40),skin,head)
        for x in [-.35,.35]:ell('ear',(x,0,0),(.08,.075,.115),skin,head)
        ell('hair cap',(0,.045,.235),(.375,.295,.22),hair,head)
        for x,z in [(-.25,.25),(-.13,.32),(.01,.33),(.16,.28),(.27,.21)]:
            o=ell('fringe',(x,-.19,z),(.13,.11,.17),hair,head);o.rotation_euler.y=-.4
        lids=eyes(head,z=.035,width=.145,y=-.269)
        ell('nose',(0,-.32,-.075),(.055,.07,.063),skin,head)
        line('smile',[(-.10,-.287,-.17),(0,-.32,-.195),(.10,-.287,-.17)],.014,dark,head)
        for x in [-.23,.23]:ell('cheek',(x,-.255,-.095),(.063,.025,.036),mat('blush',(.85,.27,.20)),head)
    else:
        fox=code=='CHAR_LILI';rabbit=code=='CHAR_POTTY';bear=code=='CHAR_MORZSI';raccoon=code=='CHAR_ZIZI'
        fur=mat('fox' if fox else code, (.80,.23,.045) if fox else ((.9,.88,.78) if rabbit else ((.30,.115,.045) if bear else (.33,.37,.40))))
        size=1.25 if bear else (.85 if code=='CHAR_BOGYO' else 1)
        root.scale=(size,)*3
        ell('body',(0,.02,.65),(.30,.24,.42),fur,root)
        ell('bib',(0,-.215,.72),(.205,.044,.26),cream,root)
        for x in [-.14,.14]:
            leg=pivot('hip',(x,0,.36),root);limbs.append(leg)
            ell('leg',(0,0,-.12),(.10,.10,.18),fur,leg);ell('paw',(0,-.07,-.27),(.13,.17,.09),cream,leg)
        for x in [-.29,.29]:
            arm=pivot('shoulder',(x,0,.89),root);limbs.append(arm)
            ell('arm',(0,0,-.16),(.08,.09,.21),fur,arm);ell('paw',(0,-.02,-.34),(.08,.09,.10),cream,arm)
        head=pivot('head',(0,-.015,1.20),root)
        ell('head',(0,0,0),(.37,.29,.33),fur,head)
        if raccoon:ell('mask',(0,-.245,.025),(.32,.075,.14),dark,head)
        for x in [-.245,.245]:
            ear=ell('ear',(x,.01,.31 if fox else .28),(.13,.11,.26 if fox else (.43 if rabbit else .13)),fur,head)
            ear.rotation_euler.y= -.22 if x<0 else .22
            ell('ear inset',(x,-.085,.35 if fox else .30),(.069,.025,.15 if fox else (.29 if rabbit else .07)),mat('ear pink',(.68,.30,.24)),head)
        ell('muzzle left',(-.105,-.26,-.115),(.17,.13,.13),cream,head);ell('muzzle right',(.105,-.26,-.115),(.17,.13,.13),cream,head)
        ell('nose',(0,-.382,-.065),(.064,.041,.045),dark,head)
        line('smile',[(-.10,-.37,-.145),(0,-.39,-.18),(.10,-.37,-.145)],.011,dark,head)
        lids=eyes(head,z=.055,width=.17,y=-.263)
        tail=pivot('tail',(.20,.16,.48),root)
        t=ell('tail',( .20,.34,.12),(.18,.43,.19),fur,tail);t.rotation_euler.z=-.55
        ell('tail tip',(.36,.59,.12),(.17,.22,.17),cream,tail)
        if raccoon:
            for x in [-.17,.17]:line('spectacles',[(x+.14*math.cos(a),-.36,.055+.15*math.sin(a)) for a in [i*math.tau/16 for i in range(17)]],.012,mat('brass',(.55,.31,.08)),head)
    return root,limbs,lids,tail

def load_master(code,location):
    path=os.path.join(os.path.dirname(__file__),'assets',code+'_DRAFT_V002.blend')
    if not os.path.isfile(path):
        raise RuntimeError('Packaged draft master is missing: '+code)
    with bpy.data.libraries.load(path,link=False) as (source,target):
        target.objects=source.objects
    objects=[o for o in target.objects if o is not None]
    for o in objects:bpy.context.collection.objects.link(o)
    root=next(o for o in objects if o.parent is None and o.name.startswith(code))
    root.location=location
    limbs=sorted([o for o in objects if o.name.split('.')[0] in ('hip','shoulder')],key=lambda o:o.name)
    lids=[o for o in objects if o.name.split('.')[0]=='blink']
    tail=next((o for o in objects if o.name.split('.')[0]=='tail' and o.type=='EMPTY'),None)
    return root,limbs,lids,tail

def forest():
    rng=random.Random(1978)
    ground=mat('moss',(.16,.32,.10));bark=mat('bark',(.20,.105,.045));path=mat('ochre path',(.57,.35,.16));stone=mat('stone',(.30,.36,.31))
    ell('forest floor',(0,1,-.52),(18,18,.52),ground)
    for y in range(-8,9):ell('winding path',(.40*math.sin(y*.5),y,-.07),(1.20,1.0,.12),path)
    for i in range(29):
        x=rng.uniform(-11,11);y=rng.uniform(2.8,13)
        if abs(x)<2 and y<6:continue
        h=rng.uniform(3.4,5.8)
        line('trunk',[(x,y,0),(x+.12,y,h*.6),(x-.1,y,h)],.14,bark)
        for j in range(3):
            ell('leaf canopy',(x+rng.uniform(-.7,.7),y+rng.uniform(-.3,.3),h+rng.uniform(-.2,.5)),(1.2,1.0,.95),mat('leaves'+str(i%4),[(.18,.38,.09),(.26,.46,.11),(.10,.29,.12),(.38,.50,.12)][i%4]))
        for j in range(2):line('branch',[(x,y,h*.55),(x+(-1 if j else 1)*.65,y,h*.82)],.065,bark)
    for i in range(85):
        x=rng.uniform(-7,7);y=rng.uniform(-3,7)
        if abs(x-.4*math.sin(y*.5))<1.35:continue
        for j in range(3):line('grass',[(x,y,0),(x+(j-1)*.07,y,.18+rng.random()*.12)],.018,mat('grass',(.30,.48,.12)))
        if i%4==0:
            line('flower stem',[(x,y,0),(x,y,.30)],.013,ground)
            petal=mat('flower'+str(i%3),[(.96,.65,.16),(.65,.30,.62),(.96,.84,.53)][i%3])
            for a in range(5):ell('petal',(x+.075*math.cos(a*math.tau/5),y+.075*math.sin(a*math.tau/5),.31),(.065,.065,.036),petal)
            ell('flower heart',(x,y,.34),(.042,.042,.035),cream if (cream:=PALETTE.get('cream')) else mat('cream',(.95,.83,.63)))
        if i%11==0:
            ell('rock',(x,y,.12),(.30,.22,.20),stone)
    # An old, luminous stone gate nested in the trees.
    brass=mat('gate stone',(.47,.37,.22));glow=mat('gate light',(.16,.70,.60),emission=2)
    points=[(1.65*math.cos(a),4.0,.15+2.9*math.sin(a)) for a in [i*math.pi/24 for i in range(25)]]
    line('Csodakapu arch',points,.25,brass);line('inlaid light',[(x,3.77,z) for x,y,z in points],.037,glow)
    for i in range(16):
        a=i*math.pi/15;ell('gate jewel',(1.65*math.cos(a),3.72,.15+2.9*math.sin(a)),(.075,.055,.075),glow)
    for i in range(20):ell('floating firefly',(rng.uniform(-1.3,1.3),rng.uniform(3.7,4.2),rng.uniform(.5,2.6)),(.023,)*3,mat('firefly',(1,.70,.16),emission=4))

def render(shot,out_dir):
    supported={"CHAR_MARK", "CHAR_LILI"}
    if any(ch['asset_id'].split('_V')[0] not in supported for ch in shot['characters']):
        raise ValueError("Storybook draft currently supports Márk and Lili only")
    bpy.ops.wm.read_factory_settings(use_empty=True);PALETTE.clear();sc=bpy.context.scene
    sc.render.threads_mode='FIXED';sc.render.threads=2
    sc.render.engine='CYCLES';sc.cycles.samples=12;sc.cycles.use_denoising=True;sc.cycles.max_bounces=3;sc.render.use_persistent_data=True
    sc.render.resolution_x=min(shot['render']['width'],768);sc.render.resolution_y=min(shot['render']['height'],432);sc.render.resolution_percentage=100
    fps=shot['render']['fps'];sc.render.fps=fps;frames=max(2,round(shot['duration_sec']*fps))
    forest()
    for pr in shot.get('props',[]):
        p=pr.get('position',[0,0,0]);glowing=pr.get('state') in ('GLOWING','ACTIVE')
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.13,location=(p[0],p[2],p[1]+.13))
        o=bpy.context.object;o.name=pr.get('asset_id','prop');o.data.materials.append(mat('star fragment',(1,.64,.14),emission=2 if glowing else 0))
    for ch in shot['characters']:
        p=ch.get('position',[0,0,0]);root,limbs,lids,tail=load_master(ch['asset_id'].split('_V')[0],(p[0],p[2],p[1]))
        walk=(ch.get('animation_code','').startswith(('walk','run')))
        head=next(o for o in root.children if o.name.split('.')[0]=='head')
        for f in range(1,frames+1):
            t=(f-1)/fps;phase=t*math.tau*1.25
            root.location.z=p[1]+(.025*abs(math.sin(phase)) if walk else .012*math.sin(t*2))
            root.location.x=p[0]+(.35*(f-1)/(frames-1) if walk else 0);root.keyframe_insert('location',frame=f)
            for j,limb in enumerate(limbs):limb.rotation_euler.x=(.30*math.sin(phase+(j%2)*math.pi) if walk else .045*math.sin(t*2+j));limb.keyframe_insert('rotation_euler',frame=f)
            head.rotation_euler.z=.05*math.sin(t*1.8);head.keyframe_insert('rotation_euler',frame=f)
            if ch.get('animation_code') == 'wave_hello':
                arm=limbs[3];arm.rotation_euler.y=-1.9;arm.rotation_euler.x=.25*math.sin(t*6);arm.keyframe_insert('rotation_euler',frame=f)
            for lid in lids:
                blink=(t%2.8)>2.60 and (t%2.8)<2.75;lid.scale.z=.08 if blink else 1;lid.keyframe_insert('scale',frame=f)
            if tail:tail.rotation_euler.z=.20*math.sin(t*5);tail.keyframe_insert('rotation_euler',frame=f)
    world=bpy.data.worlds.new('soft sky');sc.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.46,.65,.80,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    for name,pos,energy,color,size in [('sunlight',(-3,-4,7),1100,(1,.78,.51),5),('sky fill',(4,-1,5),650,(.55,.76,1),5),('rim',(0,5,5),1300,(1,.68,.31),4)]:
        d=bpy.data.lights.new(name,'AREA');d.energy=energy;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    d=bpy.data.cameras.new('story camera');cam=bpy.data.objects.new('story camera',d);sc.collection.objects.link(cam);sc.camera=cam;d.lens=shot['camera'].get('lens_mm',42)
    xs=[c.get('position',[0,0,0])[0] for c in shot['characters']];center=sum(xs)/max(1,len(xs));kind=shot['camera'].get('shot_type','WIDE');dist={'WIDE':8.6,'MEDIUM_WIDE':7.2,'MEDIUM':6.0,'MEDIUM_CLOSE':4.8,'CLOSE_UP':4.0}.get(kind,8.6);target=Vector((center,.30,1.55 if kind in ('CLOSE_UP','MEDIUM_CLOSE') else 1.05))
    movement=shot['camera'].get('movement','STATIC');start=(center+1,-dist,3.2);end=(center+.4,-dist*.87,2.9) if movement=='DOLLY_IN' else ((center+1,-dist*1.13,3.2) if movement=='DOLLY_OUT' else start)
    for f,pos in [(1,start),(frames,end)]:cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f)
    sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='FFMPEG';sc.render.ffmpeg.format='MPEG4';sc.render.ffmpeg.codec='H264';sc.render.ffmpeg.constant_rate_factor='HIGH'
    sc.frame_start=1;sc.frame_end=frames;out=os.path.join(out_dir,f"{shot['shot_id']}_r{shot.get('revision',1)}.mp4");sc.render.filepath=out
    bpy.ops.render.render(animation=True);return out,frames
