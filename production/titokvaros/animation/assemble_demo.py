"""Build the genuine 48-second editable development scene from the new assets.
Not production-approved. No imported old character, image slideshow or AI video.
"""
import argparse,json,math,sys,hashlib
from pathlib import Path
import bpy
from mathutils import Vector,Matrix
sys.path.insert(0,str(Path(__file__).resolve().parent))
from build_native import cube,ellipsoid,curve,material,look_at,light,bind
from motion_library import locomotion,expression,arm_direction,key,pose_position


def empty(name):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);return o


def attach(obj,parent):obj.parent=parent;return obj


def trolley(mats):
    root=empty('TV_PROP_cargo_trolley');root.location=(2.8,5,0)
    attach(cube('cargo wooden deck',(0,0,.40),(1.2,1.65,.20),mats['wood'],.05),root)
    attach(cube('cargo crate',(0,0,.84),(.90,1.06,.70),mats['wood'],.03),root)
    for z in [.58,.79,1.02]:attach(cube('cargo crate brace',(0,-.548,z),(.94,.028,.041),mats['iron'],.006),root)
    for x in [-.44,.44]:
        attach(curve('trolley handle',[(x,.70,.43),(x,.80,1.15),(x,.38,1.15)],.027,mats['iron']),root)
        for y in [-.53,.53]:
            wheel=ellipsoid('cargo wheel',(x,y,.22),(.06,.205,.205),mats['iron']);attach(wheel,root)
    attach(curve('grip contact bar',[(-.44,.38,1.15),(.44,.38,1.15)],.028,mats['iron']),root)
    pivot=empty('TV_PROP_brake_lever');pivot.parent=root;pivot.location=(.60,.70,.70)
    attach(cube('emergency lever grip',(0,0,.15),(.055,.055,.30),mats['copper'],.025),pivot)
    return root


def tram(mats):
    root=empty('TV_VEHICLE_tram')
    attach(cube('tram lower',(0,0,6.42),(3.8,1.52,.80),mats['copper'],.16),root)
    attach(cube('tram upper',(0,0,7.05),(3.55,1.46,.54),mats['trim'],.1),root)
    attach(cube('tram roof',(0,0,7.42),(3.92,1.65,.17),mats['iron'],.08),root)
    for x in [-1.30,-.60,.10,.80,1.45]:attach(cube('tram window',(x,-.742,7.06),(.5,.018,.40),mats['window'],.026),root)
    for x in [-1.2,1.2]:attach(ellipsoid('tram wheel',(x,-.61,5.94),(.30,.075,.30),mats['iron']),root)
    return root


def background_animal(index,mats):
    """Reusable, articulated background resident, distinct from named leads."""
    root=empty(f'TV_EXTRA_{index:02d}');root['asset_role']='background animal';root['species']='hedgehog' if index%2 else 'squirrel'
    cloth=material(f'extra coat {index}',[(.12,.18,.25),(.33,.15,.10),(.25,.30,.20)][index%3])
    fur=material(f'extra fur {index}',(.18+.025*index,.11,.065))
    attach(ellipsoid('extra coat',(0,0,.89),(.20,.14,.30),cloth,20,12),root)
    attach(ellipsoid('extra animal head',(0,0,1.32),(.20,.155,.19),fur,24,16),root)
    for s in [-1,1]:
        attach(ellipsoid('extra ears',(s*.14,0,1.48),(.048,.04,.09 if index%2==0 else .035),fur,16,10),root)
        attach(ellipsoid('extra eye',(s*.06,-.146,1.35),(.025,.015,.03),mats['iron'],12,8),root)
    attach(ellipsoid('extra muzzle',(0,-.17,1.26),(.105,.08,.05),mats['trim'],20,12),root)
    arms=[];legs=[]
    for s in [-1,1]:
        leg=empty('extra hip');leg.parent=root;leg.location=(s*.09,0,.70)
        attach(ellipsoid('extra trouser',(0,0,-.23),(.085,.08,.24),cloth,16,10),leg)
        attach(ellipsoid('extra shoe',(0,-.06,-.49),(.08,.14,.06),mats['iron'],16,10),leg);legs.append(leg)
        arm=empty('extra shoulder');arm.parent=root;arm.location=(s*.19,0,1.04)
        attach(ellipsoid('extra arm',(s*.015,0,-.20),(.06,.06,.22),cloth,16,10),arm);arms.append(arm)
    if index%2==0:attach(ellipsoid('extra squirrel tail',(0,.22,.75),(.16,.13,.38),fur,20,12),root)
    else:
        for j in range(12):a=j*math.tau/12;attach(ellipsoid('extra quill',(math.cos(a)*.13,.09,1.34+math.sin(a)*.13),(.032,.07,.035),fur,12,8),root)
    return root,arms,legs


def add_city_life():
    mats={k:bpy.data.materials.get(v) for k,v in {'copper':'aged copper','iron':'dark iron','trim':'cream cornice','window':'warm windows'}.items()}
    mats['wood']=material('cargo oak',(.22,.09,.035),noise=80)
    t=trolley(mats);v=tram(mats);extras=[background_animal(i,mats) for i in range(6)]
    # A readable geographical landmark with three-dimensional lettering.
    sign=cube('street sign',(-3.8,1.1,2.4),(1.65,.08,.43),mats['copper'],.045)
    d=bpy.data.curves.new('street sign lettering','FONT');d.body='RÉZRAKPART';d.size=.17;d.align_x='CENTER';d.extrude=.001
    o=bpy.data.objects.new('street sign lettering',d);bpy.context.collection.objects.link(o);o.location=(-3.8,1.045,2.34);o.rotation_euler=(math.pi/2,0,0);d.materials.append(mats['trim'])
    curve('signpost',[(-3.8,1.1,0),(-3.8,1.1,2.6)],.035,mats['iron'])
    glow=material('old conduit cyan',(.015,.31,.36),.22,.3);pr=glow.node_tree.nodes.get('Principled BSDF');pr.inputs['Emission Color'].default_value=(.04,.7,1,1)
    for x in [-.40,0,.40]:curve('subsurface conduit',[(x,-8,.027),(x,-1,.027),(x+1,1,.027),(x+1,7,.027)],.021,glow)
    return t,v,extras,pr


def path(t):
    if t<5:return 2.0-.55*t,.55,'walk',.55*t
    if t<18:return -.75,0,'idle',2.75
    if t<24:
        # Accelerating root, with the same integral driving the planted feet.
        u=t-18;dist=.6*u+.07*u*u;return -.75-dist,.6+.14*u,'run',2.75+dist
    return -6.87,0,'idle',8.87


def set_gaze(rig,frame,t,code):
    yaw=(.13 if code=='MIRA' else -.13)*math.sin(t*.32);pitch=.025*math.sin(t*1.1)
    if code=='MIRA' and 6<t<12:yaw=.28;pitch=-.04
    if code=='BRUNO' and 8.5<t<13:yaw=-.28
    if code=='KIPP' and 13<t<16:yaw=-.3;pitch=-.05
    if code=='KIPP' and 25<t<32:yaw=-.38;pitch=.14
    if code=='MIRA' and 27.8<t<32:yaw=.40;pitch=.03
    if code=='KIPP' and 32<t<37:yaw=-.24;pitch=.06
    pb=rig.pose.bones['head'];pb.rotation_euler=(pitch,.015*math.sin(t*.7),yaw);key(pb,frame)
    for side in ['L','R']:
        eye=rig.pose.bones['eye.'+side];eye.rotation_euler.x=.015*math.sin(t);eye.rotation_euler.z=.045*math.sin(t*.6);key(eye,frame)
        ear=rig.pose.bones['ear.'+side];ear.rotation_euler.y=.05*math.sin(t*1.7+(0 if side=='L' else 1));key(ear,frame)


def camera_keys(cast):
    scene=bpy.context.scene;scene.timeline_markers.clear()
    specs=[(1,144,(4,-9,3.1),(2.8,-8,2.2),(0,0,1),38),
           (145,312,(2.4,-4.4,1.82),(2.1,-4.25,1.79),(-.2,-.75,1.37),57),
           (313,432,(2.4,-3.25,1.35),(2.23,-3.1,1.33),(1.25,-.55,1.09),70),
           (433,600,(4.8,-3.2,1.8),(4.8,-9.1,1.8),(.45,-3.4,1.0),37),
           (601,792,(2.7,-11.3,1.75),(2.5,-11.1,1.68),(.1,-6.87,1.24),39),
           (793,1008,(3.8,-10.8,1.0),(3.2,-10.5,1.35),(.8,-6.7,.9),44),
           (1009,1152,(3.4,-10.8,1.9),(4.2,-12,2.2),(.2,-6.87,1.14),50)]
    for i,(a,b,start,end,target,lens) in enumerate(specs):
        d=bpy.data.cameras.new(f'TV_CAM_SH{i+1:02}');d.lens=lens;d.clip_end=160
        c=bpy.data.objects.new(d.name,d);bpy.context.collection.objects.link(c)
        frames=range(a,b+1) if i==3 else [a,b]
        for f in frames:
            if i==3:
                y=path((f-1)/24)[0];position=(5.0,y-2.2,1.8);tar=(.25,y+.15,1.0)
            else:position=start if f==a else end;tar=target
            c.location=position;look_at(c,tar);c.keyframe_insert('location',frame=f);c.keyframe_insert('rotation_euler',frame=f)
        marker=scene.timeline_markers.new(f'TV_D001_SH{(i+1)*10:03}',frame=a);marker.camera=c
    scene.camera=bpy.data.objects['TV_CAM_SH01']


def lipsync(audio_dir,report):
    """Map real provider character timings to HU visemes, coarticulate 2 frames."""
    groups={'a':'A','á':'A','e':'E','é':'E','i':'E','í':'E','o':'O','ó':'O','ö':'O','ő':'O','u':'U','ú':'U','ü':'U','ű':'U','m':'MBP','b':'MBP','p':'MBP','f':'FV','v':'FV'}
    for path_ in sorted(audio_dir.glob('TV_D001_L*.json')):
        line=json.loads(path_.read_text());audio=path_.with_suffix('.mp3')
        if line.get('status')!='RECORDED_PENDING_REVIEW' or not audio.exists():continue
        spec=next(x for x in DEMO['dialogue'] if x['id']==line['id']);shape=bpy.data.objects[spec['character']+'_ORAL_RING'].data.shape_keys.key_blocks
        a=line['alignment'];at=spec['at'];start=round(at*24)+1
        for n in ['A','E','O','U','MBP','FV']:
            k=shape['viseme_'+n];k.value=0;k.keyframe_insert('value',frame=start-2)
        events=[]
        for ch,st,en in zip(a['characters'],a['character_start_times_seconds'],a['character_end_times_seconds']):
            v=groups.get(ch.lower());
            if v:events.append((v,round((at+st)*24)+1,round((at+en)*24)+1))
        for v,st,en in events:
            k=shape['viseme_'+v];k.value=0;k.keyframe_insert('value',frame=st-2);k.value=.8;k.keyframe_insert('value',frame=st+1);k.keyframe_insert('value',frame=max(st+1,en-1));k.value=0;k.keyframe_insert('value',frame=en+2)
        if not bpy.context.scene.sequence_editor:bpy.context.scene.sequence_editor_create()
        strip=bpy.context.scene.sequence_editor.strips.new_sound(line['id'],str(audio.resolve()),channel=1,frame_start=start);strip.sound.pack()
        report['dialogue'].append({'id':line['id'],'start':start,'alignment_source':'elevenlabs with-timestamps','viseme_events':len(events),'acting_review':'PENDING','phoneme_review':'PENDING'})


def main():
    p=argparse.ArgumentParser();p.add_argument('--master',required=True);p.add_argument('--out',required=True);p.add_argument('--audio');p.add_argument('--stems');a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
    out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.open_mainfile(filepath=str(Path(a.master).resolve()),use_scripts=False)
    scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=1152;scene.render.fps=24
    for obj in bpy.data.objects:
        for mod in obj.modifiers:
            if mod.type=='ARMATURE':mod.use_deform_preserve_volume=True
    cast={c:bpy.data.objects['TV_CHAR_'+c+'_RIG'] for c in DEMO['characters']}
    trol,vehicle,extras,glow=add_city_life();emergency=light('TV_emergency_spill',(.5,-7,.25),0,(.10,.70,1),2,(0,-6,1.2));report={'production_approved':False,'stage':'ANIMATED_BLOCKING','frames':1152,'fps':24,'shots':7,'dialogue':[],'contact_samples':[],'limitations':['models not feature-film quality','full wing topology and finger contact require correction','acting and audio review pending']}
    for f in range(1,1153):
        t=(f-1)/24;y,speed,mode,distance=path(t)
        for i,(code,rig) in enumerate(cast.items()):
            rig.location=({'MIRA':-1.05,'BRUNO':.25,'KIPP':1.35}[code],y+(.28 if code=='KIPP' else 0),0)
            locomotion(rig,f,t,distance,speed,mode,phase_offset=i*.18)
            set_gaze(rig,f,t,code);expression(code,f,t,bpy.data.objects,'fear' if 24<t<32 and code=='KIPP' else 'relief' if t>40 else 'neutral')
            for side in ['L','R']:
                # Integrated bat wing fingers fold along the forearm at rest.
                if code=='KIPP':
                    for digit in ['index','middle','ring','pinky']:
                        for seg in [1,2,3]:
                            pb=rig.pose.bones[f'f_{digit}.{seg:02}.{side}'];pb.rotation_euler.x=.75 if seg>1 else .25;key(pb,f)
            if code=='BRUNO':
                grip=max(0,min(1,t-24,39-t))
                for side,sign in [('L',1),('R',-1)]:
                    parent=rig.pose.bones['upper_arm_parent.'+side];parent['IK_FK']=1-grip;parent.keyframe_insert('["IK_FK"]',frame=f)
                    parent['pole_vector']=True
                    pole=rig.pose.bones['upper_arm_ik_target.'+side];pose_position(pole,(sign*.76,.32,.98));key(pole,f)
                    hand=rig.pose.bones['hand_ik.'+side]
                    contact=Vector((.35+sign*.44,-7.75+.38,1.15))
                    local=(contact-rig.location)/rig.scale.x;local.y+=hand.bone.length
                    matrix=Vector((0,-1,0)).to_track_quat('Y','Z').to_matrix().to_4x4();matrix.translation=local;hand.matrix=matrix;key(hand,f)
                    for digit in ['thumb','index','middle','ring','pinky']:
                        for seg in [1,2,3]:
                            finger=rig.pose.bones[f'f_{digit}.{seg:02}.{side}'];finger.rotation_euler.x=(.55 if seg==1 else .9)*grip;key(finger,f)

            if code=='KIPP':
                grip=max(0,min(1,(t-32)*2,(37-t)*2));side='R'
                parent=rig.pose.bones['upper_arm_parent.'+side];parent['IK_FK']=1-grip;parent.keyframe_insert('["IK_FK"]',frame=f)
                hand=rig.pose.bones['hand_ik.'+side];target=Vector((.95,-7.05,.97));local=(target-rig.location)/rig.scale.x;local.y+=hand.bone.length
                matrix=Vector((0,-1,0)).to_track_quat('Y','Z').to_matrix().to_4x4();matrix.translation=local;hand.matrix=matrix;key(hand,f)
                for seg in [1,2,3]:
                    thumb=rig.pose.bones[f'f_thumb.{seg:02}.R'];thumb.rotation_euler.x=.65*grip;key(thumb,f)
            if 28<t<32 and code=='MIRA':
                arm_direction(rig,'L',(.36,-.02,-.08));key(rig.pose.bones['upper_arm_fk.L'],f)
        trol.location=(.35,5 if t<15 else max(-7.75,5-(t-15)*(12.75/9)),0);trol.keyframe_insert('location',frame=f)
        vehicle.location=(-15+(t*.70)%32,19,0);vehicle.keyframe_insert('location',frame=f)
        for i,(root,arms,legs) in enumerate(extras):
            direction=1 if i%2 else -1;root.location=((5.65 if i<3 else -5.65),-8+i*5+direction*.18*t,0);root.rotation_euler.z=math.pi if direction==1 else 0;root.keyframe_insert('location',frame=f)
            for j,ob in enumerate(legs+arms):ob.rotation_euler.x=.24*math.sin(t*5+j*math.pi);ob.keyframe_insert('rotation_euler',frame=f)
        lever=bpy.data.objects['TV_PROP_brake_lever'];lever.rotation_euler.x=-.75*max(0,min(1,(t-33.4)*3));lever.keyframe_insert('rotation_euler',frame=f)
        emergency.data.energy=450*max(0,min(1,(t-34)*2));emergency.data.keyframe_insert('energy',frame=f)
        for lampname,normal in [('warm key',1500),('sky fill',1200),('copper rim',1800)]:
            lamp=bpy.data.objects[lampname].data;lamp.energy=normal*(.45 if 13.1<t<34 else 1);lamp.keyframe_insert('energy',frame=f)
        glow.inputs['Emission Strength'].default_value=0 if t<34 else min(7,(t-34)*3);glow.inputs['Emission Strength'].keyframe_insert('default_value',frame=f)
    # Reusable actions can be linked independently into future shots.
    for code,rig in cast.items():
        rig.animation_data.action.name=f'TV_{code}_DEMO_BLOCKING_V001';rig.animation_data.action.use_fake_user=True
    camera_keys(cast)
    if a.audio:lipsync(Path(a.audio),report)
    if a.stems:
        if not scene.sequence_editor:scene.sequence_editor_create()
        for channel,name in enumerate(['score_original','foley_original','city_ambience'],start=2):
            wav=Path(a.stems)/(name+'.wav')
            strip=scene.sequence_editor.strips.new_sound(name,str(wav.resolve()),channel=channel,frame_start=1);strip.sound.pack()
    scene['production_approved']=False;scene['review_stage']='ANIMATED_BLOCKING';scene['not_approved_reason']='Character modeling, anatomical wing folds and physical hand contact need further authoring.'
    scene.frame_set(1);bpy.context.view_layer.update();bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(out/'TV_ANIMATED_V003.blend'))
    report['blend_sha256']=hashlib.sha256((out/'TV_ANIMATED_V003.blend').read_bytes()).hexdigest();(out/'motion_audit.json').write_text(json.dumps(report,indent=2))
    print('TV_ANIMATION_BUILT '+json.dumps({'frames':1152,'dialogue':len(report['dialogue']),'production_approved':False}),flush=True)

DEMO=json.loads((Path(__file__).resolve().parents[1]/'episodes/TV_S1E1/demo.json').read_text())
if __name__=='__main__':main()
