"""Reversible distance-driven foot plants and timed native facial acting.

Blender --python refine_character_acting.py -- ROOT SOURCE OUTPUT
Source voices and story timing are untouched. This is an animation review,
not a claim of finished phoneme alignment or approved mesh deformation.
"""
import bpy, math, json, sys, hashlib, random, bisect
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

root, source, dest = map(Path, sys.argv[sys.argv.index('--')+1:])
dest.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
s=bpy.context.scene
codes=['CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO']
rigs={c:next(o for o in s.objects if o.type=='ARMATURE' and c in o.name) for c in codes}
bodies={c:max((o for o in s.objects if o.type=='MESH' and any(m.type=='ARMATURE' and m.object==r for m in o.modifiers)),key=lambda o:len(o.data.vertices)) for c,r in rigs.items()}
speech=json.loads((root/'episode-v017/speech_motion_V017.json').read_text())['records']
beats=json.loads((root/'episode-v016/S1E1_timeline_V016.json').read_text())['beats']
texts={b['beat_id']:b.get('text_hu','') for b in beats if 'beat_id' in b}
frames=np.arange(s.frame_start,s.frame_end+1,2)
roots={c:r.parent for c,r in rigs.items()}
def sample_curve(o,path,index,fallback):
 action=o.animation_data.action if o.animation_data else None
 fc=action.fcurves.find(path,index=index) if action else None
 return np.array([fc.evaluate(float(f)) for f in frames]) if fc else np.full(len(frames),fallback)
# These source root/head channels are directly keyed, with no constraints.
# Read the curves rather than evaluating every skinned mesh 13,346 times.
sample={}
for c,r in rigs.items():
 p=roots[c];head=r.pose.bones['head']
 sample[c]={'p':np.column_stack([sample_curve(p,'location',i,p.location[i]) for i in range(3)]),
            'z':sample_curve(p,'rotation_euler',2,p.rotation_euler.z),
            'head':np.column_stack([sample_curve(r,head.path_from_id('rotation_euler'),i,head.rotation_euler[i]) for i in range(3)])}
 print('SOURCE_TRACKS_SAMPLED',c,len(frames),flush=True)

def smooth(x):
 x=max(0.,min(1.,float(x)));return x*x*(3-2*x)

def write_keys(o,path,index,values):
 o.animation_data_create()
 if not o.animation_data.action:o.animation_data.action=bpy.data.actions.new(o.name+' V018 acting')
 action=o.animation_data.action
 old=action.fcurves.find(path,index=index)
 if old:action.fcurves.remove(old)
 fc=action.fcurves.new(path,index=index);fc.keyframe_points.add(len(values))
 fc.keyframe_points.foreach_set('co',np.column_stack((frames,values)).ravel())
 for k in fc.keyframe_points:k.interpolation='LINEAR'
 fc.update()
 if o.animation_data.action_slot is None:o.animation_data.action_slot=action.slots[0]
 return fc

# World-space terrain queries include both playable stages and bridges.
ground_names=['forest floor','forest path','woodland terrain','island','bridge deck','bridge plank']
ground_trees=[]
s.frame_set(s.frame_start)
for o in s.objects:
 if o.type=='MESH' and not o.hide_render and any(n in o.name.lower() for n in ground_names):
  ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh()
  vs=[ev.matrix_world@v.co for v in m.vertices];polys=[p.vertices[:] for p in m.polygons]
  ground_trees.append(BVHTree.FromPolygons(vs,polys));ev.to_mesh_clear()
def floor(x,y,fallback):
 hits=[]
 for tree in ground_trees:
  p,normal,_,_=tree.ray_cast(Vector((x,y,4)),Vector((0,0,-1)),8)
  if p is not None and normal.z>.25:hits.append(p.z)
 return max(hits) if hits else fallback

# Keep authored interaction arm poses, and replace arbitrary imported bone tails
# by anatomical joint connections before adding measured two-bone IK chains.
controllers={};leg_reports=[]
# Sole centres measured from low vertices, excluding the tail's deform weights.
quad_soles={
 'CHAR_LILI':{'foreL':(-.10169,-.29151),'foreR':(-.25743,-.21605),'hindL':(.07574,.08845),'hindR':(-.11019,.20484)},
 'CHAR_BOGYO':{'foreL':(.00490,-.28816),'foreR':(-.27147,-.17683),'hindL':(.29690,.20636),'hindR':(-.00682,.41670)}}
for ci,c in enumerate(codes):
 r=rigs[c];body=bodies[c]
 if body.hide_render:continue
 biped='thigh.L' in r.data.bones
 bpy.ops.object.select_all(action='DESELECT');r.select_set(True);bpy.context.view_layer.objects.active=r;bpy.ops.object.mode_set(mode='EDIT')
 legs=[]
 if biped:
  for side in ['L','R']:
   thigh=r.data.edit_bones['thigh.'+side];shin=r.data.edit_bones['shin.'+side];foot=r.data.edit_bones['foot.'+side]
   if c=='CHAR_MARK' and not any(k.type=='IK' for k in r.pose.bones['shin.'+side].constraints):
    sign=1 if side=='L' else -1
    foot.head.x=sign*.118;foot.head.y=-.035;shin.head.x=sign*.105;shin.head.y=-.018;thigh.head.x=sign*.080
   thigh.tail=shin.head;shin.tail=foot.head;foot.tail=foot.head+Vector((0,-.05,-.03))
   legs.append(('shin.'+side,'foot.'+side,side,0 if side=='L' else .5,True))
 else:
  for part in ['fore','hind']:
   for side in ['L','R']:
    upper=r.data.edit_bones[part+'leg.'+side];paw=r.data.edit_bones[part+'paw.'+side]
    x,y=quad_soles[c][part+side]
    upper.head.x=x;upper.head.y=y+(.10 if part=='fore' else .06)
    paw.head.x=x;paw.head.y=y+.035
    upper.tail=paw.head;paw.tail=Vector((x,y-.020,.04 if c=='CHAR_LILI' else .035))
    # Walk: stagger all four contacts; do not use a diagonal trot.
    phase={('fore','L'):0.,('hind','R'):.25,('fore','R'):.5,('hind','L'):.75}[(part,side)]
    legs.append((part+'paw.'+side,part+'paw.'+side,part+side,phase,False))
 bpy.ops.object.mode_set(mode='OBJECT')
 if not biped:
  # Correct only the lower-leg deformation, preserving fur, UVs and upper body.
  coords=np.array([v.co[:] for v in body.data.vertices]);candidate_names=[name for name in r.data.bones.keys() if any(n in name for n in ['leg.','paw.'])]+['pelvis']
  distances=[]
  for name in candidate_names:
   a=np.array(r.data.bones[name].head_local);b=np.array(r.data.bones[name].tail_local);ab=b-a
   u=np.clip(((coords-a)@ab)/(ab@ab),0,1);distances.append(np.linalg.norm(coords-a-u[:,None]*ab,axis=1))
  ds=np.column_stack(distances);chosen=np.argpartition(ds,3,axis=1)[:,:3];weight=(np.take_along_axis(ds,chosen,axis=1)+.018)**-6;weight/=weight.sum(axis=1,keepdims=True)
  tail_ids={g.index for g in body.vertex_groups if 'tail' in g.name}
  for vi,v in enumerate(body.data.vertices):
   mask=1-smooth((v.co.z-.17)/.13)
   if sum(g.weight for g in v.groups if g.group in tail_ids)>.15:mask=0
   if mask<=1e-6:continue
   old={g.group:g.weight for g in v.groups};total=sum(old.values())
   for gi,amount in old.items():body.vertex_groups[gi].add([vi],amount*(1-mask),'REPLACE')
   for ji,wgt in zip(chosen[vi],weight[vi]):
    group=body.vertex_groups.get(candidate_names[int(ji)]) or body.vertex_groups.new(name=candidate_names[int(ji)])
    group.add([vi],old.get(group.index,0)*(1-mask)+total*mask*float(wgt),'REPLACE')
 # The original surface minimum establishes the sole-to-joint clearance.
 relative=roots[c].matrix_world.inverted()@body.matrix_world
 root_scale=roots[c].matrix_world.to_scale()
 sole=min((relative@v.co).z for v in body.data.vertices)*root_scale.z
 scale=r.matrix_world.to_scale().z
 for name,foot_name,label,phase,ankle in legs:
  # Existing SC003 authored pickup feet take precedence while kneeling.
  if any(k.type=='IK' for k in r.pose.bones[name].constraints):continue
  goal=bpy.data.objects.new(c+'_V018_PLANT_'+label,None);s.collection.objects.link(goal)
  pole=bpy.data.objects.new(c+'_V018_KNEE_'+label,None);s.collection.objects.link(pole)
  b=r.pose.bones[name];con=b.constraints.new('IK');con.name='V018 grounded distance gait';con.target=goal;con.chain_count=2;con.pole_target=pole;con.pole_angle=math.pi/2
  # An ankle target terminates at the shin tail; paws terminate at their toe.
  local=r.data.bones[foot_name].head_local.copy() if ankle else r.data.bones[foot_name].tail_local.copy()
  anchor=(roots[c].matrix_world.inverted()@r.matrix_world)@local
  anchor=Vector((anchor.x*root_scale.x,anchor.y*root_scale.y,anchor.z*root_scale.z))
  clearance=anchor.z-sole
  orient=None
  if ankle:
   orient=r.pose.bones[foot_name].constraints.new('COPY_ROTATION');orient.name='V018 stable sole rotation';orient.target=goal;orient.target_space='WORLD';orient.owner_space='WORLD'
  controllers.setdefault(c,[]).append((goal,pole,anchor,clearance,phase,ankle,foot_name,con))
  leg_reports.append({'character':c,'leg':label,'chain':2,'clearance_m':float(clearance),'contact_method':'WORLD_SPACE_STANCE_HOLD_DISTANCE_PHASE'})
 # IK controls the legs; remove the original free-running sinusoidal tracks.
 if r.animation_data and r.animation_data.action:
  for fc in list(r.animation_data.action.fcurves):
   if any('"'+n in fc.data_path for n in ['thigh.','shin.','foot.','foreleg.','hindleg.','forepaw.','hindpaw.']):r.animation_data.action.fcurves.remove(fc)
 data=sample[c];p=data['p'];delta=np.diff(p[:,:2],axis=0);length=np.linalg.norm(delta,axis=1)
 teleports=np.flatnonzero(length>4)+1;length[length>4]=0
 distance=np.r_[0,np.cumsum(length)]
 speed=np.r_[length[0],length]*12
 moving=speed>.025
 stride=(.32 if biped else .12)*scale
 phase_stride=np.maximum(stride,.30*speed[1:])
 if not biped:phase_stride=np.minimum(phase_stride,.15*scale)
 heading=data['z'].copy()
 turn_distance=np.zeros(len(length))
 for i in range(1,len(heading)):
  if i in teleports:continue
  d=delta[i-1]
  desired=math.atan2(float(d[0]),-float(d[1])) if moving[i] else float(data['z'][i])
  diff=(desired-heading[i-1]+math.pi)%math.tau-math.pi
  change=max(-.13 if moving[i] else -.09,min(.13 if moving[i] else .09,diff))
  heading[i]=heading[i-1]+change
  if not moving[i] and abs(change)>.008:
   turn_distance[i-1]=abs(change)*(.20 if biped else .14)*scale
   moving[i]=True
 phases=np.r_[0,np.cumsum((length+turn_distance)/phase_stride)]
 # Capture one location per stance, retaining the location until toe-off.
 values={id(g):{'p':[],'pole':[],'r':[]} for g,_,_,_,_,_,_,_ in controllers.get(c,[])}
 state={id(g):{'plant':None,'cycle':None,'stop':0,'last':None} for g,_,_,_,_,_,_,_ in controllers.get(c,[])}
 root_z=[]
 for i,f in enumerate(frames):
  yaw=float(heading[i]);rot=Matrix.Rotation(yaw,4,'Z');forward=Vector((math.sin(yaw),-math.cos(yaw),0))
  fallback=float(p[i,2]+sole)
  ground=floor(float(p[i,0]),float(p[i,1]),fallback)
  # Small pelvis weight transfer; no bouncing when the actor is stationary.
  bob=.006*math.cos(phases[i]*math.tau*2) if moving[i] else 0
  root_z.append(ground-sole-(.050 if biped else .055)+bob)
  for goal,pole,anchor,clearance,offset,ankle,foot_name,con in controllers.get(c,[]):
   st=state[id(goal)];phase=phases[i]+offset;cycle=math.floor(phase);q=phase-cycle
   step_stride=max(stride,float(speed[i])*.30)
   if not biped:step_stride=min(step_stride,.15*scale)
   neutral=Vector((p[i,0],p[i,1],0))+rot@Vector((anchor.x,anchor.y,0))
   neutral.z=floor(neutral.x,neutral.y,ground)+clearance
   if i in teleports or st['plant'] is None:
    initial=neutral+forward*((.32-q)*step_stride if moving[i] else 0)
    initial.z=floor(initial.x,initial.y,ground)+clearance
    st.update(plant=initial.copy(),last=initial.copy(),cycle=cycle,stop=0)
   if moving[i]:
    st['stop']=0
    if cycle!=st['cycle']:
     st['plant']=neutral+forward*((.32-q)*step_stride)
     st['plant'].z=floor(st['plant'].x,st['plant'].y,ground)+clearance
     st['cycle']=cycle
    running=roots[c].get('run_start_frame',1e12)<=f<=roots[c].get('run_end_frame',-1)
    stance=.38 if running else .62
    if q<stance:pos=st['plant'].copy()
    else:
     u=smooth((q-stance)/(1-stance));landing=neutral+forward*(step_stride*.32)
     landing.z=floor(landing.x,landing.y,ground)+clearance
     pos=st['plant'].lerp(landing,u);pos.z+=math.sin(math.pi*u)*(.13 if running else .065 if biped else .045)*scale
   else:
    st['stop']+=1
    # Complete the last small settling step instead of freezing a raised foot.
    u=smooth(st['stop']/4)
    pos=st['last'].lerp(neutral,u) if st['stop']<4 else neutral.copy()
    st['plant']=pos.copy();st['cycle']=cycle
   st['last']=pos.copy();values[id(goal)]['p'].append(tuple(pos))
   knee=neutral+forward*((-.55 if 'fore' in goal.name else .55)*scale);knee.z=ground+.35*scale;values[id(goal)]['pole'].append(tuple(knee))
   world=Matrix.Rotation(yaw,4,'Z')@r.matrix_world.to_3x3().to_4x4()@r.data.bones[foot_name].matrix_local
   # Rest orientation includes the rig's transform, but not the old root heading.
   rest_rotation=(roots[c].matrix_world.inverted()@r.matrix_world).to_quaternion()
   rotation=(Matrix.Rotation(yaw,4,'Z').to_quaternion()@rest_rotation@r.data.bones[foot_name].matrix_local.to_quaternion()).to_euler('XYZ')
   values[id(goal)]['r'].append(tuple(rotation))
 for goal,pole,anchor,clearance,offset,ankle,foot_name,con in controllers.get(c,[]):
  arr=values[id(goal)]
  for axis in range(3):
   fc=write_keys(goal,'location',axis,np.array(arr['p'])[:,axis]);write_keys(pole,'location',axis,np.array(arr['pole'])[:,axis])
   write_keys(goal,'rotation_euler',axis,np.array(arr['r'])[:,axis])
   for j in teleports:
    if j>0:fc.keyframe_points[int(j)-1].interpolation='CONSTANT'
 if controllers.get(c):
  write_keys(roots[c],'location',2,root_z)
  write_keys(roots[c],'rotation_euler',2,heading)
 print('GROUND_GAIT',c,len(controllers.get(c,[])),flush=True)

# Real surface-following eyelids: a retracting skin mesh covers the existing eye.
# Every eye profile was checked against a front texture projection of this asset.
eyes={
 'CHAR_MARK':[(-.059,.828,.022,.017),(.017,.831,.022,.018)],
 'CHAR_LILI':[(-.186,.722,.031,.028),(-.060,.700,.029,.030)],
 'CHAR_MORZSI':[(-.017,.807,.033,.030),(.091,.779,.029,.030)],
 'CHAR_POTTY':[(0,.628,.036,.032),(.104,.652,.037,.030)],
 'CHAR_ZIZI':[(-.097,.779,.028,.031),(-.002,.751,.029,.033)],
 'CHAR_BOGYO':[(-.178,.742,.028,.038),(-.019,.704,.032,.045)]}
face_reports=[]
for ci,c in enumerate(codes):
 body=bodies[c];r=rigs[c]
 if body.hide_render:continue
 body.data.calc_loop_triangles();vs=[v.co.copy() for v in body.data.vertices];ts=[t.vertices[:] for t in body.data.loop_triangles]
 uvs=[[Vector((*body.data.uv_layers.active.data[l].uv,0)) for l in t.loops] for t in body.data.loop_triangles]
 tree=BVHTree.FromPolygons(vs,ts)
 atlas=next(n.image for n in body.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.image.colorspace_settings.name=='sRGB')
 pixels=np.empty(len(atlas.pixels),dtype=np.float32);atlas.pixels.foreach_get(pixels);pixels=pixels.reshape(atlas.size[1],atlas.size[0],4)
 def surface(x,z):
  p,_,idx,_=tree.ray_cast(Vector((x,-2,z)),Vector((0,1,0)))
  if p is None:
   p,_,idx,d=tree.find_nearest(Vector((x,-.24,z)))
   if p is None or d>.18:raise ValueError(c+' eyelid ray missed facial surface')
  return p,idx
 def color(x,z):
  p,idx=surface(x,z);uv=barycentric_transform(p,*[vs[v] for v in ts[idx]],*uvs[idx]);rgb=pixels[int(np.clip(uv.y,0,1)*(atlas.size[1]-1)),int(np.clip(uv.x,0,1)*(atlas.size[0]-1)),:3]
  return np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 for ei,(cx,cz,w,h) in enumerate(eyes[c]):
  verts=[];closed=[];colors=[];polys=[];nx,ny=33,13
  for iy in range(ny):
   v=iy/(ny-1)
   for ix in range(nx):
    u=-1+2*ix/(nx-1);edge=math.sqrt(max(.005,1-u*u))*h;x=cx+u*w
    z=cz+edge+(1-v)*.00012;p,_=surface(x,z);verts.append((x,p.y-.0015,z))
    zclosed=cz+edge*(1-2*v);p,_=surface(x,zclosed);closed.append((x,p.y-.0020,zclosed))
    candidates=[color(cx+sign*w*1.30,cz+h*.35) for sign in [-1,1]]+[color(x,cz+h*1.5)]
    candidates.sort(key=lambda rgb:float(sum(rgb)))
    colors.append(tuple(candidates[1])+(1.,))
  for iy in range(ny-1):
   for ix in range(nx-1):a=iy*nx+ix;polys.append((a,a+1,a+nx+1,a+nx))
  mesh=bpy.data.meshes.new(c+f' eyelid {ei} surface');mesh.from_pydata(verts,[],polys)
  lid=bpy.data.objects.new(c+f'_V018_EYELID_{ei}',mesh);s.collection.objects.link(lid)
  lid.parent=r;lid.matrix_parent_inverse=r.matrix_world.inverted()@body.matrix_world;lid.matrix_basis.identity();lid.hide_render=body.hide_render
  group=lid.vertex_groups.new(name='head');group.add(list(range(len(verts))),1.,'REPLACE');mod=lid.modifiers.new('Native head skin','ARMATURE');mod.object=r
  mat=bpy.data.materials.new(lid.name+' matched skin');mat.use_nodes=True;bs=mat.node_tree.nodes['Principled BSDF'];bs.inputs['Roughness'].default_value=.7
  vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='SourceSkin';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color']);mesh.materials.append(mat)
  col=mesh.color_attributes.new(name='SourceSkin',type='FLOAT_COLOR',domain='CORNER')
  for loop in mesh.loops:col.data[loop.index].color=colors[loop.vertex_index]
  for p in mesh.polygons:p.use_smooth=True
  lid.shape_key_add(name='Basis');blink=lid.shape_key_add(name='Blink')
  for i,p in enumerate(closed):blink.data[i].co=p
  fc=blink.driver_add('value');drv=fc.driver;var=drv.variables.new();var.name='b';var.type='SINGLE_PROP';var.targets[0].id=r;var.targets[0].data_path='["blink"]';drv.expression='max(0,min(1,b))'
  # A fine crease follows the closing lid; the open mesh has zero area.
  line_open=[];line_closed=[];line_faces=[]
  for ix in range(33):
   u=-.91+1.82*ix/32;x=cx+u*w;top=cz+h*math.sqrt(1-u*u)
   for side in [-1,1]:
    p,_=surface(x,top);line_open.append((x,p.y-.0024,top))
    z=cz-h*.1+h*.16*u*u+side*.00045;p,_=surface(x,z);line_closed.append((x,p.y-.0028,z))
  for ix in range(32):a=ix*2;line_faces.append((a,a+1,a+3,a+2))
  data=bpy.data.meshes.new(lid.name+' crease');data.from_pydata(line_open,[],line_faces);crease=bpy.data.objects.new(lid.name+'_CREASE',data);s.collection.objects.link(crease)
  crease.parent=r;crease.matrix_parent_inverse=r.matrix_world.inverted()@body.matrix_world;crease.matrix_basis.identity()
  vg=crease.vertex_groups.new(name='head');vg.add(list(range(len(line_open))),1.,'REPLACE');mod=crease.modifiers.new('Native lid crease skin','ARMATURE');mod.object=r
  shade=bpy.data.materials.new(crease.name+' shade');shade.use_nodes=True;shade.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.055,.018,.012,1);data.materials.append(shade)
  crease.shape_key_add(name='Basis');closed_key=crease.shape_key_add(name='Blink')
  for ix,p in enumerate(line_closed):closed_key.data[ix].co=p
  d=closed_key.driver_add('value').driver;v=d.variables.new();v.name='b';v.type='SINGLE_PROP';v.targets[0].id=r;v.targets[0].data_path='["blink"]';d.expression='max(0,min(1,b))'
 rng=random.Random(18018+ci);blinks=[];t=(s.frame_start-1)/24+rng.uniform(1.6,3.8)
 while t<(s.frame_end-1)/24:
  blinks.append(t);t+=rng.uniform(3.1,6.7)
 # Brief closures at some sentence endings; never regular metronomic blinking.
 records=[rec for rec in speech if rec['character']==c and rec['end_frame']>=s.frame_start and rec['start_frame']<=s.frame_end]
 blinks += [(rec['end_frame']+4)/24 for i,rec in enumerate(records) if i%3==1]
 blink_values=[];head_values=[];smiles=[];brows=[]
 own={rec['beat_id']:rec for rec in records}
 active_speech=sorted([rec for rec in speech if rec['end_frame']>=s.frame_start and rec['start_frame']<=s.frame_end],key=lambda rec:rec['start_frame'])
 starts=[rec['start_frame'] for rec in active_speech]
 for i,f in enumerate(frames):
  t=(int(f)-1)/24;b=0.
  for bt in blinks:
   dt=t-bt
   if -.085<=dt<=.17:b=max(b,smooth((dt+.085)/.085) if dt<0 else 1-smooth(dt/.17))
  j=bisect.bisect_right(starts,int(f))-1;rec=active_speech[max(0,j)] if active_speech else None
  speaking=bool(rec and rec['character']==c and rec['start_frame']-4<=f<=rec['end_frame']+6)
  partner=rec['character'] if rec and rec['character']!=c else ('CHAR_LILI' if c=='CHAR_MARK' else 'CHAR_MARK')
  direction=sample[partner]['p'][i]-sample[c]['p'][i]
  yaw=sample[c]['z'][i];local=Matrix.Rotation(-float(yaw),4,'Z')@Vector(direction)
  gaze=max(-.34,min(.34,math.atan2(local.x,-local.y)*.42)) if np.linalg.norm(direction[:2])>.12 else 0
  original=sample[c]['head'][i]
  # Preserve purposeful authored bends; replace mechanical constant swaying.
  pitch=float(original[0])*.65+(.025*math.sin(t*2.0+ci) if speaking else .008*math.sin(t*.5+ci))
  roll=.02*math.sin(t*.45+ci)
  surprise=0;happy=.20
  for ownrec in records:
   a=(ownrec['start_frame']-5)/24;end=(ownrec['end_frame']+7)/24
   if a<=t<=end:
    weight=smooth((t-a)/.2)*smooth((end-t)/.3);txt=texts.get(ownrec['beat_id'],'').lower();isreact=ownrec.get('kind')=='REACTION'
    if isreact:
     laugh='laugh' in ownrec['beat_id'] or 'success' in ownrec['beat_id'];surprise=max(surprise,weight*(.20 if laugh else .9));happy=max(happy,weight*(.80 if laugh else .1));pitch-=weight*.025
     if 'sneeze' in ownrec['beat_id']:b=max(b,weight)
     elif not laugh:b*=1-weight
    else:
     surprise=max(surprise,weight*(.45 if ('?' in txt or 'hű' in txt) else .12));happy=max(happy,weight*(.52 if any(w in txt for w in ['jó','köszön','siker','szép','megvan']) else .25))
  blink_values.append(b);head_values.append((pitch,roll,gaze));smiles.append(happy);brows.append(surprise)
 r['blink']=0.;write_keys(r,'["blink"]',0,blink_values);write_keys(r,'["smile"]',0,smiles);write_keys(r,'["brow_raise"]',0,brows)
 for axis in range(3):write_keys(r,r.pose.bones['head'].path_from_id('rotation_euler'),axis,np.array(head_values)[:,axis])
 face_reports.append({'character':c,'eyelids':2,'blink_events':len(blinks),'reaction_tracks':sum(rec.get('kind')=='REACTION' for rec in records),'gaze_method':'CLAMPED_PARTNER_HEAD_TURN','independent_iris_motion':False})
 print('FACE_ACTING',c,len(blinks),flush=True)

ik_errors=[]
for f in np.linspace(s.frame_start,s.frame_end,25,dtype=int):
 s.frame_set(int(f))
 for c,r in rigs.items():
  for bone in r.pose.bones:
   for con in bone.constraints:
    if con.type=='IK' and con.name=='V018 grounded distance gait':
     ik_errors.append({'frame':int(f),'character':c,'bone':bone.name,'error_m':float(((r.matrix_world@bone.tail)-con.target.matrix_world.translation).length)})
s['status']='V018_GROUNDED_GAIT_FACIAL_ACTING_REVIEW';s['full_episode_finished']=False;s['final_acting_approved']=False
bpy.ops.file.pack_all();s.frame_set(s.frame_start);bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
report={'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'legs':leg_reports,'faces':face_reports,'ik_samples':ik_errors,'maximum_ik_target_error_m':max((x['error_m'] for x in ik_errors),default=0),'audio_unchanged':True,'full_episode_finished':False,'production_approved':False,'pending':['Visual deformation and contact review','Independent eye gaze','Human phoneme review','Final scene lighting']}
dest.with_suffix('.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('ACTING_SOURCE_SAVED',dest,flush=True)
