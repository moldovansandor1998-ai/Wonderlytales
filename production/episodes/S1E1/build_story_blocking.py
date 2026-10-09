"""First story-wide native blocking pass for SC004–019.
Every plot mechanism is a native moving prop. This pass is not final acting,
contact, facial or lighting approval. Time is the accepted V016 soundtrack.
"""
import bpy,sys,json,math,bisect,hashlib
from pathlib import Path
from mathutils import Vector, Matrix
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v017'
bpy.ops.wm.open_mainfile(filepath=str(out/'S1E1_SC001_NATIVE_ACTING_V017.blend'));s=bpy.context.scene;s.frame_set(1600)
codes=['CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI','CHAR_BOGYO'];rigs={c:next(o for o in s.objects if o.type=='ARMATURE' and c in o.name) for c in codes};roots={c:r.parent for c,r in rigs.items()};zbase={c:float(p.location.z) for c,p in roots.items()}
for o in s.objects:
 if o.animation_data:o.animation_data.action=None
 if o.type=='LIGHT' and o.data.animation_data:o.data.animation_data.action=None
for m in bpy.data.materials:
 if m.node_tree and m.node_tree.animation_data:m.node_tree.animation_data.action=None
for r in rigs.values():
 for b in r.pose.bones:
  if b.name!='jaw':b.rotation_euler=(0,0,0)
 for prop in ['mouth_open','mouth_round','smile','brow_raise']:r[prop]=0.
for o in s.objects:
 if o.type=='MESH' and any(m.type=='ARMATURE' and m.object in rigs.values() for m in o.modifiers):o.hide_render=False
 if any(v in o.name.lower() for v in ['pillar stone','continuous ancient stone arch']):o.hide_render=False
for name in ['Leaf lifted by the signal','Small travelling signal','Flat stone hiding the fragment']:
 if name in bpy.data.objects:bpy.data.objects[name].hide_render=True
s.frame_start=3603;s.frame_end=30294;s.render.fps=24;s.timeline_markers.clear();s.render.use_sequencer=False
if s.sequence_editor:
 for strip in s.sequence_editor.strips:
  if strip.type=='SOUND':strip.frame_final_end=30295

_keys={}
def key(o,path,values,f):
 if isinstance(values,(float,int)):values=[values]
 for i,v in enumerate(values):_keys.setdefault((o,path,i),[]).extend((f,float(v)))
def keyprop(o,path,f):key(o,path,getattr(o,path),f)
def flush_keys():
 for (o,path,index),points in _keys.items():
  o.animation_data_create()
  if not o.animation_data.action:o.animation_data.action=bpy.data.actions.new(o.name+' Story motion')
  fc=o.animation_data.action.fcurves.new(data_path=path,index=index);fc.keyframe_points.add(len(points)//2);fc.keyframe_points.foreach_set('co',points)
  for k in fc.keyframe_points:k.interpolation='LINEAR'
  fc.update()
 print('BULK_KEYS_SAVED',len(_keys),flush=True)
def frame(t):return 1+round(t*24)
def smooth(x):x=max(0,min(1,x));return x*x*(3-2*x)
def pulse(t,a,b,fade=.6):return smooth((t-a)/fade)*smooth((b-t)/fade)
def material(name,c,em=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.65
 if em:bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=em
 return m
ivory=material('Story cloth ivory',(.67,.57,.38));orange=material('Return marker orange',(.85,.20,.025));gold=material('Story warm gold',(.62,.35,.055));teal=material('Story teal',(.025,.28,.32));blue=material('Portal gentle turquoise',(.04,.45,.56),1.2);wood=material('Basket wicker',(.34,.17,.045));dark=material('Story dark line',(.025,.045,.05));water=material('Garden running water',(.045,.36,.60),.25);pink=material('Garden flower pink',(.62,.17,.30));green=material('Living root soft green',(.18,.34,.055));stone_mat=material('Tunnel pale stone',(.43,.37,.25))
def box(name,pos,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat);b=o.modifiers.new('Soft native edges','BEVEL');b.width=.025;b.segments=2;return o
def sphere(name,pos,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
 return o
def curve(name,points,radius,mat):
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.bevel_depth=radius;d.bevel_resolution=2;sp=d.splines.new('POLY');sp.points.add(len(points)-1)
 for p,co in zip(sp.points,points):p.co=(*co,1)
 d.materials.append(mat);o=bpy.data.objects.new(name,d);s.collection.objects.link(o);return o
# Append the existing garden mechanism and parent it into a separate native set.
with bpy.data.libraries.load(str(root/'episode-v016/S1E1_BELL_GARDEN_MECHANISM_V016.blend'),link=False) as (a,b):b.objects=[n for n in a.objects if not any(x in n.lower() for x in ['camera','light','soft warm key','sky fill'])]
garden=[o for o in b.objects if o]
groot=bpy.data.objects.new('Garden set origin',None);s.collection.objects.link(groot);groot.location.x=40
for o in garden:
 s.collection.objects.link(o)
 if not o.parent:o.parent=groot
# Put the playable controls on the middle island and bells on the far island.
for o in garden:
 name=o.name
 if any(v in name for v in ['Bellows base','Leather folds','Leaf pedal','Symbol plaque','Circle symbol','Two dots symbol','Wave symbol']):
  if o.animation_data and o.animation_data.action:
   for fc in o.animation_data.action.fcurves:
    if fc.data_path=='location' and fc.array_index==1:
     for k in fc.keyframe_points:k.co.y+=6;k.handle_left.y+=6;k.handle_right.y+=6
  o.location.y+=6
 if name.startswith('Air pipe '):
  x=o.data.splines[0].points[0].co.x
  pts=[(x,6.25,.25),(x,6.9,.25),(2.6,7,.8),(5.5+x,7,2.7),(5.5+x,7,3.1)]
  for p,v in zip(o.data.splines[0].points,pts):p.co=(*v,1)
 if any(v in name for v in ['Bell pivot','Bell tower crossbeam','Bell tower support']):o.location.x+=5.5;o.location.y+=5.2
 if name.startswith('Leaf-shaped disk housing'):o.location=(1.7,6.1,.24)
# Disk and groove retrieval have visible owner changes.
disk=next(o for o in garden if o.name.startswith('Recoverable brass circle disk'))
if disk.animation_data:disk.animation_data.action=None
disk.parent=None
housing=next(o for o in garden if o.name.startswith('Leaf-shaped disk housing'))
# The garden has a separate visible return portal and marker bush.
portal= sphere('Forest gate light opening',(0,6,1.13),(.98,.025,1.1),blue)
return_portal=sphere('Garden return opening',(40,-2.0,1.10),(.92,.025,1.03),blue)
for x in [39.65,40,40.35]:sphere('Return marker bush',(x,-1.4,.4),(.42,.3,.38),green)
ribbon=box('Orange ribbon on return bush',(40,-1.70,.58),(.055,.013,.35),orange)
# Native ring at the central island, with a stable shallow fragment seat.
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.44,depth=.09,location=(40,.85,.14));ring=bpy.context.object;ring.name='Three-symbol listening circle';ring.data.materials.append(teal)
for i,(dx,c) in enumerate([(-.22,gold),(0,blue),(.22,gold)]):sphere('Circle listening light '+str(i),(40+dx,.82,.21),(.06,.06,.012),c)
seat=sphere('Stable cloth depression beside controls',(39.55,5.15,.15),(.20,.18,.06),stone_mat)
# A low, wide covered groove has actual walls, roof and an open side for the camera.
box('Safe tunnel floor',(41.55,5.45,.09),(.56,1.35,.10),stone_mat)
box('Safe tunnel outer wall',(41.82,5.45,.54),(.08,1.35,.83),stone_mat)
lid=box('Light removable tunnel cover',(41.55,5.45,.96),(.62,1.40,.08),stone_mat)
for yy in [5.05,5.3,5.55,5.8]:box('Tunnel viewing grille',(41.27,yy,.51),(.025,.025,.82),gold)
rootplant=curve('Living root across air channel',[(41.5,5.8,.11),(41.52,5.55,.15),(41.6,5.3,.12),(41.45,5.1,.13)],.035,green)
rootplant.shape_key_add if False else None
stick=box('Zizi curved passage test stick',(41.15,5.15,.4),(.025,.55,.025),wood)
pebble=sphere('Actual pebble under wind vane',(45.07,5.78,.22),(.10,.07,.06),stone_mat)
# The wind wheel and small channels visibly resume only after the solution.
wheelroot=bpy.data.objects.new('Garden wind wheel axle',None);s.collection.objects.link(wheelroot);wheelroot.location=(45.5,7,3.75)
for i in range(4):
 o=box('Wind wheel blade '+str(i),(0,0,0),(.12,.08,1.0),gold);o.parent=wheelroot;o.location=(0,0,.40);o.rotation_euler.y=i*math.pi/2
channel=box('Water channel trough',(40,5.0,.14),(2.6,.20,.10),stone_mat);flow=box('Water in channel',(40,5,.20),(2.5,.13,.02),water)
flowers=[]
for j,(x,y) in enumerate([(-1.8,5.05),(-1.9,6.8),(.9,7.2),(5.6,5.2)]):
 stem=curve('Flower stem '+str(j),[(40+x,y,.15),(40+x,y,.48)],.018,green)
 for k in range(5):
  a=k*2*math.pi/5;o=sphere('Opening flower petal '+str(j)+' '+str(k),(40+x+.075*math.cos(a),y+.075*math.sin(a),.5),(.085,.045,.025),pink);o.rotation_euler.z=a;flowers.append(o)
# Full star outline is a different shape from the carried incomplete fragment.
curve('Gate complete-star socket',[(.16*math.cos(k*math.pi/5+math.pi/2)*(1 if k%2==0 else .45),5.94,.68+.16*math.sin(k*math.pi/5+math.pi/2)*(1 if k%2==0 else .45)) for k in range(11)],.016,gold)
# Mark's evaluated wrist goals hold the cloth at both edges in carrying beats.
mark=rigs['CHAR_MARK'];bpy.ops.object.select_all(action='DESELECT');mark.select_set(True);bpy.context.view_layer.objects.active=mark;bpy.ops.object.mode_set(mode='EDIT')
for side in ['L','R']:
 for parent,child in [('upper_arm','forearm'),('forearm','hand')]:mark.data.edit_bones[parent+'.'+side].tail=mark.data.edit_bones[child+'.'+side].head
 hand=mark.data.edit_bones['hand.'+side];hand.tail=hand.head+Vector((0,0,-.06))
bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update();cloth_goals=[]
for side in ['L','R']:
 goal=bpy.data.objects.new('Story cloth wrist '+side,None);s.collection.objects.link(goal);goal.rotation_euler=(mark.matrix_world@mark.data.bones['hand.'+side].matrix_local).to_euler()
 ik=mark.pose.bones['forearm.'+side].constraints.new('IK');ik.target=goal;ik.chain_count=2;ik.use_stretch=False
 rot=mark.pose.bones['hand.'+side].constraints.new('COPY_ROTATION');rot.target=goal;rot.owner_space='WORLD';rot.target_space='WORLD';cloth_goals.append((side,goal,ik,rot))
# Plot props: cloth, basket, flask, Zizi machine and notes; no additional cast.
cloth=box('Carried protective cloth',(0,0,0),(.28,.20,.018),ivory);shard=bpy.data.objects['Story star fragment under the stone'];shard.hide_render=False
basket=box('Morzsi picnic basket',(0,0,0),(.36,.26,.26),wood);handle=curve('Picnic basket handle',[(-.15,0,.13),(-.15,0,.40),(.15,0,.40),(.15,0,.13)],.015,wood);handle.parent=basket;handle.matrix_parent_inverse=Matrix.Diagonal((1/.36,1/.26,1/.26,1))
flask=sphere('Potty capped water flask',(0,0,0),(.065,.065,.16),teal)
machine=box('Zizi all-purpose meter',(0,0,0),(.31,.23,.12),teal);needle=box('Meter moving pointer',(0,0,0),(.015,.13,.013),gold);needle.parent=machine;needle.matrix_parent_inverse=Matrix.Diagonal((1/.31,1/.23,1/.12,1));needle.location=(0,0,.08)
for dx,dy in [(-.14,-.08),(.14,-.08),(0,.1)]:
 o=sphere('Meter little wheel',(dx,dy,-.065),(.035,.025,.035),dark);o.parent=machine;o.matrix_parent_inverse=Matrix.Diagonal((1/.31,1/.23,1/.12,1))
notes=box('Zizi ordinary notebook',(0,0,0),(.16,.025,.23),ivory)
# Many dim map circles, a single lit circle, then a feather hint; no new world.
map_parts=[]
for i in range(7):
 a=i*2*math.pi/7;cx=40+.32*math.cos(a);cy=.85+.32*math.sin(a)
 o=curve('Map dim circle '+str(i),[(cx+.06*math.cos(k*math.pi/12),cy+.06*math.sin(k*math.pi/12),.23) for k in range(25)],.008,blue if i==0 else gold);map_parts.append(o)
feather=curve('Unexplained feather gate hint',[(-.1,5.94,2.23),(0,5.94,2.33),(.12,5.94,2.51)],.012,gold)
for v in range(4):curve('Feather hint barb '+str(v),[(v*.03-.04,5.94,2.31+v*.04),(v*.03+.03,5.94,2.29+v*.04)],.009,gold).parent=feather
snacks=[sphere('Shared picnic bite '+str(i),(0,0,0),(.04,.04,.025),gold) for i in range(6)]
# Exact global paths. Instant changes between sets are editorial cuts, never travel over a void.
forest={'CHAR_MARK':(-.15,.85),'CHAR_LILI':(-1.55,.9),'CHAR_MORZSI':(1.2,1.8),'CHAR_POTTY':(.65,1.35),'CHAR_ZIZI':(2,1.5),'CHAR_BOGYO':(.3,.35)}
gate={'CHAR_MARK':(-.35,4.9),'CHAR_LILI':(-1.25,4.7),'CHAR_MORZSI':(1.1,4.0),'CHAR_POTTY':(.45,4.3),'CHAR_ZIZI':(1.75,4.5),'CHAR_BOGYO':(-.1,4.0)}
entry={'CHAR_MARK':(39.65,.1),'CHAR_LILI':(38.8,.1),'CHAR_MORZSI':(41.2,-.5),'CHAR_POTTY':(40.6,-.25),'CHAR_ZIZI':(41.7,.2),'CHAR_BOGYO':(40,-.55)}
controls={'CHAR_MARK':(40,6.66),'CHAR_LILI':(39.0,5.25),'CHAR_MORZSI':(38.8,6.66),'CHAR_POTTY':(40.65,5.3),'CHAR_ZIZI':(41.2,6.66),'CHAR_BOGYO':(40.10,5.05)}
paths={c:[] for c in codes}
def anchor(c,t,xy,cut=False):paths[c].append((t,Vector((xy[0],xy[1],zbase[c]+(.08 if xy[0]>20 else 0))),cut))
for i,c in enumerate(codes):
 start=forest[c] if c in codes[:2] else (forest[c][0],forest[c][1]+3.2)
 for t,xy,cut in [(150.083,start,False),(159.3,forest[c],False),(237.5,forest[c],False),(253.0,gate[c],False),(379.9,gate[c],False),(389.80,(gate[c][0],5.9),False),(389.9167,entry[c],True),(470.96,entry[c],False),(474+i*.5,(39.85+(i%2)*.3,2.55),False),(479+i*.35,(39.85+(i%2)*.3,4.8),False),(482.95,controls[c],False),(542.375,controls[c],False),(986.0,controls[c],False)]:anchor(c,t,xy,cut)
 if c in ['CHAR_MARK','CHAR_LILI','CHAR_MORZSI','CHAR_ZIZI']:
  for t,xy in [(990.2,(41.65,5.9+(i%2)*.2)),(994.5,(44.5,5.9+(i%2)*.2)),(998.1,(45.2+(i%2)*.5,5.4+(i//2)*.5)),(1023.38,(45.2+(i%2)*.5,5.4+(i//2)*.5)),(1026.7,(44.5,5.9+(i%2)*.2)),(1030.7,(41.65,5.9+(i%2)*.2)),(1035.8,controls[c])]:anchor(c,t,xy)
 else:anchor(c,1035.8,controls[c])
 for t,xy,cut in [(1144.46,controls[c],False),(1148.4,(39.85+(i%2)*.3,4.8),False),(1152,(39.85+(i%2)*.3,2.55),False),(1157,entry[c],False),(1163.9,(entry[c][0],-1.75),False),(1164.0,gate[c],True),(1176.6,gate[c],False),(1182,(forest[c][0],forest[c][1]+1.4),False),(1211,(forest[c][0],forest[c][1]+1.4),False),(1221,(forest[c][0],forest[c][1]+.25),False),(1241.25,(forest[c][0],forest[c][1]+.25),False),(1247.25,(forest[c][0],forest[c][1]-1.8),False),(1262.25,(forest[c][0],forest[c][1]-1.8),False)]:anchor(c,t,xy,cut)
# Potty's actual sideways trip along the shallow covered groove, with ear fold.
paths['CHAR_POTTY']=[x for x in paths['CHAR_POTTY'] if not 611<x[0]<776]
for t,xy in [(611.75,(40.9,4.75)),(627.7,(41.1,4.9)),(671.8,(41.15,4.9)),(683.83,(41.55,5.10)),(708.6,(41.55,5.35)),(719,(41.55,5.65)),(737,(41.55,5.65)),(749,(41.15,4.9)),(757,(40.9,5.1)),(776.4,controls['CHAR_POTTY'])]:anchor('CHAR_POTTY',t,xy)
for c in paths:paths[c].sort(key=lambda x:x[0])
def position(c,t):
 p=paths[c];i=max(0,min(len(p)-2,bisect.bisect_right([a[0] for a in p],t)-1));a,b=p[i],p[i+1]
 if b[2]:return a[1].copy() if t<b[0] else b[1].copy()
 return a[1].lerp(b[1],smooth((t-a[0])/max(.001,b[0]-a[0])))
# All accepted spoken slots and selected reaction performances drive draft mouths.
speech=json.loads((out/'speech_motion_V017.json').read_text());count=0
for rec in speech['records']:
 if int(rec['scene'][-3:])<4:continue
 r=rigs[rec['character']];count+=1
 for prop,keys in [('mouth_open',rec['open_keys']),('mouth_round',rec['round_keys'])]:
  for f,v in keys:r[prop]=v;r.keyframe_insert(data_path='["'+prop+'"]',frame=f+1)
# Sampling keyed bones: walking only where actual root travel happens; pauses remain alive.
for f in range(3603,30296,4):
 t=(f-1)/24
 for ci,c in enumerate(codes):
  r=rigs[c];p=position(c,t);speed=(position(c,t+.10)-position(c,t-.10)).length/.2;walking=min(1,speed*3);phase=t*(7.2+ci*.24)+ci
  roots[c].location=p+Vector((0,0,.008*abs(math.sin(phase))*walking));direction=position(c,t+.10)-position(c,t-.10);roots[c].rotation_euler.z=math.atan2(direction.x,-direction.y) if speed>.025 else .08*math.sin(t*.3+ci)
  if c=='CHAR_POTTY' and 671.8<t<749:roots[c].rotation_euler.z=-math.pi/2
  for path in ['location','rotation_euler']:keyprop(roots[c],path,f)
  interact=0
  if c=='CHAR_MORZSI':interact=pulse(t,494.6,500.6)+pulse(t,542.4,549)+pulse(t,612,623)+pulse(t,665,757)+pulse(t,791.5,799.5)+pulse(t,819,829)+pulse(t,919.21,922.0)+pulse(t,998.2,1018.4)+pulse(t,1046,1049)
  if c=='CHAR_MARK':interact=pulse(t,513.25,520.25)+pulse(t,542.4,549)+pulse(t,791.5,815.5)+pulse(t,922,924.5)+pulse(t,998.2,1018.4)+pulse(t,1049,1052)
  if c=='CHAR_POTTY':interact=pulse(t,503.54,509.54)+pulse(t,719,749)
  if c=='CHAR_ZIZI':interact=pulse(t,182.3,190.3)+pulse(t,642.4,650.4)+pulse(t,791.5,799.5)+pulse(t,819,829)+pulse(t,924.5,927)+pulse(t,998.2,1018.4)+pulse(t,1052,1055)
  if c=='CHAR_LILI':interact=pulse(t,209.2,216.2)+pulse(t,452.9,460.9)+pulse(t,805.5,815.5)+pulse(t,1012.38,1018.38)
  cuddle=pulse(t,765.4,770.4)+pulse(t,1205,1211)
  for b in r.pose.bones:
   if b.name=='jaw':continue
   rot=[0.,0.,0.]
   if b.name=='head':rot=[.045*math.sin(t*1.4+ci)+.14*interact,.04*math.sin(t*.5+ci),.08*math.sin(t*.7+ci)]
   if b.name in ['spine','chest']:rot[0]=.02*math.sin(t*1.8+ci)+.12*interact
   if b.name.startswith('thigh.'):rot[0]=.21*math.sin(phase+(math.pi if b.name.endswith('R') else 0))*walking
   if b.name.startswith('shin.'):rot[0]=max(0,math.sin(phase+(math.pi if b.name.endswith('R') else 0)))*.24*walking
   if b.name.startswith('upper_arm.'):rot[0]=-.15*math.sin(phase+(math.pi if b.name.endswith('R') else 0))*walking-.5*min(1,interact);rot[2]=(.08 if b.name.endswith('L') else -.08)*interact
   if b.name.startswith('forearm.'):rot[0]=.12+.35*min(1,interact)
   if b.name.startswith('foreleg.'):rot[0]=.17*math.sin(phase+(math.pi if b.name.endswith('R') else 0))*walking+.24*interact
   if b.name.startswith('hindleg.'):rot[0]=-.16*math.sin(phase+(math.pi if b.name.endswith('R') else 0))*walking
   if b.name.startswith('tail'):rot[2]=.10*math.sin(t*2.7+ci)*(1+.8*cuddle)
   if b.name.startswith('ear_base') and c=='CHAR_POTTY':rot[0]=.8*pulse(t,671.8,749,.8)
   if b.name=='head' and c=='CHAR_BOGYO':rot[0]+=.18*pulse(t,169.3,174.3)+.2*pulse(t,611.7,623.7)
   b.rotation_euler=rot;key(r,b.path_from_id('rotation_euler'),rot,f)
  r['smile']=.15+.35*cuddle+.15*pulse(t,1069.6,1100);key(r,'["smile"]',r['smile'],f)
  r['brow_raise']=.6*pulse(t,552.5,555.5)+.45*pulse(t,302,309);key(r,'["brow_raise"]',r['brow_raise'],f)
 if f%2400<4:print('STORY_BONE_FRAME',f,flush=True)
# Native prop positions and ownership; shard never jumps between characters.
for f in range(3603,30296,4):
 t=(f-1)/24;pm=position('CHAR_MARK',t);po=position('CHAR_POTTY',t);mz=position('CHAR_MORZSI',t);zz=position('CHAR_ZIZI',t)
 bag=pm+Vector((0,.18,1.15));carry=pm+Vector((0,-.27,.93));stable=Vector((39.55,5.15,.22))
 clothpos=carry
 if 603.75<=t<842.625:clothpos=carry.lerp(bag,smooth((t-603.75)/6));
 if 842.625<=t<854.6:clothpos=bag.lerp(carry,smooth((t-843)/5))
 if 911.2<=t<1109.5:clothpos=carry.lerp(stable,smooth((t-912)/5))
 if 1109.5<=t<1121.5:clothpos=stable.lerp(carry,smooth((t-1110)/5))
 if 1176.6<t<1211:clothpos=pm+Vector((0,-.22,.71))
 for side,goal,ik,rot in cloth_goals:
  goal.location=clothpos+Vector(((.13 if side=='L' else -.13),-.015,.13));keyprop(goal,'location',f)
  hold=not (603.75<t<842.625 or 919.2<t<1109.5)
  if side=='R' and (513<t<550 or 791<t<815):hold=False
  ik.influence=1. if hold else 0.;rot.influence=ik.influence;key(mark,ik.path_from_id('influence'),ik.influence,f);key(mark,rot.path_from_id('influence'),rot.influence,f)
 cloth.location=clothpos;shard.location=clothpos+Vector((0,0,.025));keyprop(cloth,'location',f);keyprop(shard,'location',f)
 # The housing, groove, rabbit, bear and housing again are actual disk stations.
 dp=Vector((41.7,5.8,.30))
 if 552.38<=t<719:dp=Vector((41.7,5.8,.30)).lerp(Vector((41.55,5.6,.16)),smooth((t-552.38)/5))
 if 719<=t<749:dp=Vector((41.55,5.6,.16)).lerp(po+Vector((0,-.14,.46)),smooth((t-719)/6))
 if 749<=t<819.04:dp=(po+Vector((0,-.14,.46))).lerp(mz+Vector((-.2,-.17,.65)),smooth((t-749)/5))
 if 819.04<=t<829.04:dp=(mz+Vector((-.2,-.17,.65))).lerp(Vector((41.7,5.8,.30)),smooth((t-819.04)/9))
 disk.location=dp;disk.rotation_euler=(math.pi/2,0,2.5*pulse(t,552.4,559.4));keyprop(disk,'location',f);keyprop(disk,'rotation_euler',f)
 basket.location=mz+Vector((.34,-.04,.49))
 if 389.9167<t<1144.46:basket.location=Vector((41.2,-.50,.24))
 keyprop(basket,'location',f)
 flask.location=po+Vector((-.18,-.05,.48));flask.rotation_euler.y=-.9*pulse(t,792,799);keyprop(flask,'location',f);keyprop(flask,'rotation_euler',f)
 machine.location=zz+Vector((.15,-.32,.40));machine.rotation_euler.x=math.pi*pulse(t,186,199.2);keyprop(machine,'location',f);keyprop(machine,'rotation_euler',f)
 needle.rotation_euler.z=1.2*math.sin(t*6)*pulse(t,182.3,209.2);keyprop(needle,'rotation_euler',f)
 notes.location=zz+Vector((-.14,-.20,.59));notes.scale=(.16,.025,.23) if (276.4<t<288.5 or 858.3<t<872) else (.001,)*3;keyprop(notes,'location',f);keyprop(notes,'scale',f)
 lid.rotation_euler.y=.35*(pulse(t,611.75,757,.8)+pulse(t,791.5,815.5,.8));keyprop(lid,'rotation_euler',f)
 stick.scale=(.025,.55,.025) if 642.38<t<650.38 else (.001,)*3;stick.rotation_euler.z=.45*pulse(t,645,649);keyprop(stick,'scale',f);keyprop(stick,'rotation_euler',f)
 rootplant.location.x=.32*smooth((t-805.5)/8);keyprop(rootplant,'location',f)
 pebble.location=Vector((45.07,5.78,.22))+Vector((-.45,0,.22))*smooth((t-1012.4)/4);keyprop(pebble,'location',f)
 wheelroot.rotation_euler.y=max(0,t-1069.67)*1.4;keyprop(wheelroot,'rotation_euler',f)
 flow.scale.z=.001+.019*smooth((t-1069.67)/10);keyprop(flow,'scale',f)
 for pet in flowers:pet.rotation_euler.y=.9*(1-smooth((t-1069.67)/10));keyprop(pet,'rotation_euler',f)
 for o in map_parts:o.scale=(1,1,1) if 1110<t<1144 else (.001,)*3;keyprop(o,'scale',f)
 ribbon.scale=(.055,.013,.35) if 387<t<1151 else (.001,)*3;keyprop(ribbon,'scale',f)
 portal.scale=(.98,.025,1.1) if 293<t<1169 else (.001,)*3;keyprop(portal,'scale',f)
 return_portal.scale=(.92,.025,1.03) if 293<t<1169 else (.001,)*3;keyprop(return_portal,'scale',f)
 feather.scale=(1,1,1) if (1222<t<1228 or 1242<t<1247) else (.001,)*3;keyprop(feather,'scale',f)
 for i,o in enumerate(snacks):
  o.location=position(codes[i],t)+Vector((0,-.20,.52 if i else .92));o.scale=(.04,.04,.025) if 1179+i*.4<t<1205 else (.001,)*3;keyprop(o,'location',f);keyprop(o,'scale',f)
flush_keys()
# Source soundtrack SFX drives correct pedal pushes and pauses in the native set.
# Existing V016 mechanism curves remain preserved above, including bell swings.
# Cameras show speakers and the actual changed props. No still-image placeholders.
tl=json.loads((root/'episode-v016/S1E1_timeline_V016.json').read_text());beats=[b for b in tl['beats'] if int(b['scene'][-3:])>=4]
def add_camera(name,t0,t1,target,p,lens=42):
 data=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,data);s.collection.objects.link(o);data.lens=lens
 for t,offset in [(t0,0),(t1,.08)]:o.location=Vector(p)+Vector((offset,0,0));o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.keyframe_insert('location',frame=frame(t));o.keyframe_insert('rotation_euler',frame=frame(t))
 marker=s.timeline_markers.new(name,frame=frame(t0));marker.camera=o
 if not s.camera:s.camera=o
 return o
prop_shots=[(182.33,190.33,lambda t:position('CHAR_ZIZI',t)+Vector((.1,-.3,.45))), (288.5,296.5,lambda t:Vector((0,6,1.10))), (432.08,442.08,lambda t:Vector((40,5,.3))), (482.96,490.96,lambda t:Vector((40,6,.35))), (552.38,559.38,lambda t:Vector((41.55,5.6,.25))), (611.75,623.75,lambda t:Vector((41.55,5.5,.52))), (719,727,lambda t:Vector((41.55,5.6,.38))), (805.5,815.5,lambda t:Vector((41.6,5.3,.18))), (819.04,829.04,lambda t:Vector((41.7,5.8,.33))), (934.92,946.92,lambda t:Vector((43.2,6,.35))), (1012.38,1018.38,lambda t:Vector((45.07,5.8,.5))), (1069.67,1087.67,lambda t:Vector((42.5,5.5,1.3))), (1109.5,1121.5,lambda t:Vector((40,.85,.27))), (1221,1229,lambda t:Vector((0,6,2.35)))]
heights={'CHAR_MARK':1.31,'CHAR_LILI':.70,'CHAR_MORZSI':.95,'CHAR_POTTY':.78,'CHAR_ZIZI':.91,'CHAR_BOGYO':.44}
for idx,b in enumerate(beats):
 a=b['start_frame']/24;end=b['end_frame']/24;mid=(a+end)/2;scene=int(b['scene'][-3:]);name=b['beat_id'];prop=next((v for v in prop_shots if abs(a-v[0])<.04),None)
 if scene==19:continue
 if b['kind']=='DIALOGUE':
  c=b['character'];p=position(c,mid);target=p+Vector((0,0,heights[c]));campos=target+Vector((-.55,-1.9,.20));lens=52
 elif prop:
  target=prop[2](mid);campos=target+Vector((1.6,-2.2,1.05));lens=45
 elif scene in [5,6] and a<389.9167:
  target=Vector((0,5.1,1.1));campos=Vector((3.6,.0,2.5));lens=35
 elif a<389.9167 or a>=1164:
  target=sum((position(c,mid) for c in codes),Vector())/6+Vector((0,0,.65));campos=target+Vector((-3.8,-5.5,2.3));lens=37
 else:
  target=sum((position(c,mid) for c in codes),Vector())/6+Vector((0,0,.7));campos=target+Vector((-3.8,-5.5,2.4));lens=36
 add_camera(name,a,end,target,campos,lens)
# Editorial cuts across the two native sets override a beat camera at the exact crossing.
for t in [389.9167,1164.0]:
 target=sum((position(c,t+.1) for c in codes),Vector())/6+Vector((0,0,.7));add_camera('Portal editorial crossing '+str(t),t,t+3,target,target+Vector((-3.8,-5.5,2.4)),36)
# A true garden establishing shot replaces the portal glimpse, showing the existing world.
add_camera('Glance through the gate into Szélkert',302.29,320.29,(42,5.4,1.3),(48,-5,5.8),35)
# End credits are native text. Exact contributors and licenses are also in the bundle.
credits=material('Closing credit warm ivory',(.86,.78,.60),.2)
for text,z in [('WONDERLYTALES',3.0),('Csodakapu — Az első darab',2.3),('Animációs munkaváltozat V017',1.65),('3D: Tripo • Blender',1.0),('Magyar hangok: ElevenLabs',.45),('Zene: saját • hangeffektusok: CC0',-.1)]:
 data=bpy.data.curves.new('Actual credit text','FONT');data.body=text;data.align_x='CENTER';data.size=.34 if z==3 else .18;data.extrude=.001;data.materials.append(credits);o=bpy.data.objects.new('End credit '+text,data);s.collection.objects.link(o);o.location=(80,0,z);o.rotation_euler=(math.pi/2,0,0)
add_camera('True contributor credits',1247.25,1262.25,(80,0,1.55),(80,-7,1.55),42)
s['status']='STORY_WIDE_NATIVE_BLOCKING_REVIEW_V017';s['full_episode_finished']=False;s['acting_approved']=False;s['facial_approved']=False;s['contact_approved']=False
s.frame_set(22200);bpy.ops.file.pack_all();dest=out/'S1E1_SC004_019_STORY_BLOCKING_V017.blend';bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
(out/'story_blocking_QC_V017.json').write_text(json.dumps({'scenes':[f'S1E1_SC{i:03}' for i in range(4,20)],'applied_speech_tracks':count,'source_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'full_episode_finished':False,'final_acting_contact_lighting_approved':False,'stage':'FIRST_NATIVE_STORY_BLOCKING_PASS','timing_source':'accepted V016 soundtrack','open_tasks':['Review all prop contacts and hand grips','Improve eye gaze, blinks, mouth articulation','Final forest and garden lighting with contact shadows','Replace blocking poses with approved acting'],'set_crossings':'Editorial camera cuts, no traversal through empty space'},indent=2))
print('STORY_NATIVE_BLOCKING_SAVED',flush=True)
