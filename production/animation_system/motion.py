"""Anatomy-aware reusable motion functions, sampled into native Blender Actions.

Foot contacts are planned in world space. Character roots do not drag stance
targets along their route. These are development clips, not approved acting.
"""
import math
from .spec import lerp, smooth, QUADRUPEDS, CLIPS

CATALOG={
 'idle':{'loop':True,'seconds':4,'layer':'body'},
 'walk':{'loop':True,'seconds':.9,'stance':.64,'lift':.075,'layer':'locomotion'},
 'run':{'loop':True,'seconds':.58,'stance':.40,'lift':.13,'layer':'locomotion'},
 'turn':{'loop':False,'seconds':1.2,'layer':'locomotion'},
 'jump':{'loop':False,'seconds':1.2,'layer':'locomotion'},
 'sit':{'loop':False,'seconds':1.6,'layer':'body'},
 'talk':{'loop':True,'seconds':3.4,'layer':'upper_body'},
 'laugh':{'loop':False,'seconds':2,'layer':'upper_body'},
 'cry':{'loop':True,'seconds':3,'layer':'upper_body'},
 'surprise':{'loop':False,'seconds':1.6,'layer':'upper_body'},
 'fear':{'loop':True,'seconds':3,'layer':'upper_body'},
 'pickup':{'loop':False,'seconds':3,'layer':'interaction','requires':'prop'},
 'interact':{'loop':False,'seconds':2.8,'layer':'interaction','requires':'partner'},
}

def active_action(actor,t):
 return next((a for a in actor.get('actions',[]) if a['start']<=t<a['end']),{'clip':'idle','start':max((a['end'] for a in actor.get('actions',[]) if a['end']<=t),default=0),'end':1e9})

def root_at(actor,t):
 pos=list(actor['position']);yaw=actor.get('yaw',0.)
 for a in sorted(actor.get('actions',[]),key=lambda a:a['start']):
  if t<a['start']:break
  if 'destination' in a:
   u=max(0,min(1,(t-a['start'])/(a['end']-a['start'])))
   # Ease acceleration/deceleration while retaining a stable central speed.
   # Integral of a trapezoidal velocity curve (normalized exactly).
   eased=(u*u/.18 if u<.1 else (1-(1-u)**2/.18 if u>.9 else (u-.05)/.9))
   target=a['destination'];delta=[target[i]-pos[i] for i in range(3)]
   if abs(delta[0])+abs(delta[1])>1e-8 and a['clip'] in ('walk','run'):
    desired=math.atan2(delta[0],-delta[1]);yaw+=((desired-yaw+math.pi)%math.tau-math.pi)*smooth((t-a['start'])/min(.3,(a['end']-a['start'])*.2))
   pos=lerp(pos,target,eased)
  if a['clip']=='turn':
   u=smooth((t-a['start'])/(a['end']-a['start']));target=a.get('yaw',yaw);difference=(target-yaw+math.pi)%(2*math.pi)-math.pi;yaw+=difference*u
 return pos,yaw

def world_offset(pos,yaw,offset):
 c,s=math.cos(yaw),math.sin(yaw);x,y,z=offset
 return [pos[0]+c*x-s*y,pos[1]+s*x+c*y,pos[2]+z]

def _foot_raw(actor,foot,t,scale=1.):
 """Return ankle position, planted flag and contact-id, with fixed stance anchors."""
 a=active_action(actor,t);kind=a['clip'];pos,yaw=root_at(actor,t);rest=foot['ankle'];turn_steps=kind=='turn' and foot.get('foot','').startswith(('forepaw','hindpaw'));phase=({'forepaw.L':0.,'forepaw.R':.5,'hindpaw.L':.75,'hindpaw.R':.25}.get(foot['foot'],foot['phase']) if kind=='walk' or turn_steps else foot['phase']) if 'foot' in foot else foot['phase']
 if kind not in ('walk','run','turn','jump'):
  prior=next((step for step in sorted(actor.get('actions',[]),key=lambda step:step['end'],reverse=True) if step['end']<=t and step['clip'] in ('walk','run','turn','jump')),None)
  if prior:
   q,_,contact=_foot_raw(actor,foot,prior['end']-1e-7,scale)
   return q,True,'settled:'+str(prior['end'])+':'+contact
  return world_offset(pos,yaw,[v*scale for v in rest]),True,'rest'
 if kind=='turn' and not turn_steps:
  elapsed=t-a['start'];duration=a['end']-a['start'];half=duration/2;is_first=phase<.5
  start=a['start']+(0 if is_first else half);end=start+half
  before=(t<=start);after=(t>=end)
  p0,y0=root_at(actor,a['start']);p1,y1=root_at(actor,a['end']-1e-6)
  q0=foot_at(actor,foot,a['start']-1e-7,scale)[0] if a['start']>0 else world_offset(p0,y0,[v*scale for v in rest]);q1=world_offset(p1,y1,[v*scale for v in rest])
  if before:return q0,True,'turn_before'
  if after:return q1,True,'turn_after'
  u=(t-start)/half;q=lerp(q0,q1,smooth(u));lift=min(.045,foot.get('leg_length',float('inf'))*.18);q[2]+=lift*scale*math.sin(math.pi*u)**2;return q,False,'turn_step'
 if kind=='jump':
  u=(t-a['start'])/(a['end']-a['start']);q=world_offset(pos,yaw,[v*scale for v in rest]);q[2]+=.23*scale*math.sin(math.pi*u)**2
  return q,u<.12 or u>.88,'jump'
 # Short quadruped legs need several planted turning steps. Moving a paw to
 # the final 180-degree heading while the body is halfway makes IK impossible.
 cycle=.55 if turn_steps else a.get('cycle_seconds',CATALOG[kind]['seconds']);stance=.58 if turn_steps else CATALOG[kind]['stance'];phase_time=(t-a['start'])/cycle+phase
 k=math.floor(phase_time);u=phase_time-k
 contact=a['start']+(k-phase)*cycle
 # Previewing the centre of the coming support period bounds ankle reach.
 p0,y0=root_at(actor,max(a['start'],min(a['end']-1e-6,contact+cycle*stance*.5)))
 p1,y1=root_at(actor,max(a['start'],min(a['end']-1e-6,contact+cycle*(1+stance*.5))))
 q0=world_offset(p0,y0,[v*scale for v in rest]);q1=world_offset(p1,y1,[v*scale for v in rest])
 if contact<=a['start']+1e-8:
  q0=foot_at(actor,foot,a['start']-1/24,scale)[0];q0[2]=root_at(actor,a['start'])[0][2]+rest[2]*scale
 if u<stance:return q0,True,str(k)
 swing_start=contact+cycle*stance;landing=min(a['end'],contact+cycle)
 # Finish an interrupted final swing at the action boundary; never blend a
 # grounded foot sideways after the walk has ended.
 swing=max(0.,min(1.,(t-swing_start)/max(1e-7,landing-swing_start)))
 q=lerp(q0,q1,smooth(swing))
 # Clearance scales with the actual limb, not overall character height. The
 # short hind legs of Lili and Potty cannot take a human-sized 7.5 cm step.
 # A squared sine has zero vertical velocity at lift-off and landing.
 lift=min(.035 if turn_steps else CATALOG[kind]['lift'],foot.get('leg_length',float('inf'))*(.26 if kind=='run' else .18))
 q[2]+=lift*scale*math.sin(math.pi*swing)**2
 return q,False,str(k)

def foot_at(actor,foot,t,scale=1.):
 q,planted,contact=_foot_raw(actor,foot,t,scale);a=active_action(actor,t);elapsed=t-a['start']
 if a['start']>0 and 0<=elapsed<.16 and a['clip'] in ('walk','run','turn','jump'):
  old,was_planted,_=foot_at(actor,foot,a['start']-1/24,scale);u=smooth(elapsed/.16);distance=math.sqrt(sum((x-y)**2 for x,y in zip(q,old)));q=lerp(old,q,u);planted=planted and was_planted and distance<1e-5
 return q,planted,contact

def pose_at(code,clip,t,duration=None):
 """Semantic bone rotations in radians, separate pelvis/torso/head/limbs."""
 quad=code in QUADRUPEDS;u=t/max(.001,duration or CATALOG[clip]['seconds']);fade=math.sin(math.pi*min(1,max(0,u))) if not CATALOG[clip]['loop'] else 1
 p={'pelvis':[0,0,0],'spine':[0,0,0],'neck':[0,0,0],'head':[0,0,0]}
 if not quad:p['chest']=[0,0,0]
 if clip in ('walk','run'):
  cycle=CATALOG[clip]['seconds'];phase=math.tau*t/cycle;amount=.025 if clip=='walk' else .06
  p['pelvis']=[0,.028*math.sin(phase),amount*math.sin(phase)];p['spine']=[.035 if clip=='walk' else .12,-.018*math.sin(phase),-amount*.65*math.sin(phase)]
  p['head']=[-.012*math.sin(phase*2),.008*math.cos(phase),0]
  if not quad:
   p['chest']=[-.012,0,-amount*.35*math.sin(phase)]
   for side,offset in [('L',0),('R',math.pi)]:
    p['upper_arm.'+side]=[(.17 if clip=='walk' else .33)*math.sin(phase+offset),0,0];p['forearm.'+side]=[-(.12 if clip=='walk' else .45),0,0]
 else:
  if clip=='idle':p['spine'][0]=.009*math.sin(t*.8);p['neck'][0]=-.006*math.sin(t*.8)
  if clip=='talk':
   p['head']=[.025*math.sin(t*3.1),.035*math.sin(t*1.7),.013*math.sin(t*2.3)];p['spine']=[-.014*math.sin(t*1.5),.025*math.sin(t*.9),0]
   if not quad:p['forearm.R']=[-.26*max(0,math.sin(t*2.1)),0,0];p['hand.R']=[0,0,.045*math.sin(t*2.1)]
  if clip=='surprise':p['head']=[-.14*fade,0,0];p['spine']=[-.06*fade,0,0]
  if clip=='fear':p['head']=[.05,.09*math.sin(t*1.9),.02];p['spine']=[.075,0,0]
  if clip=='laugh':p['head']=[-.10+.045*math.sin(t*12),0,0];p['spine']=[.04*math.sin(t*12),0,0]
  if clip=='cry':p['head']=[.13,.02*math.sin(t*2),0];p['spine']=[.065+.01*math.sin(t*9),0,0]
  if clip=='jump':p['spine']=[.09*math.sin(u*math.tau),0,0];p['head']=[-.04*fade,0,0]
  if clip=='sit':p['spine']=[-.05*smooth(u),0,0];p['head']=[.025*smooth(u),0,0]
  if clip=='pickup':
   reach=smooth(u/.35)*(1-smooth((u-.75)/.25));p['spine']=[.17*reach,0,0];p['head']=[.12*reach,0,0]
   if not quad:p['upper_arm.R']=[-.34*reach,0,-.08*reach];p['forearm.R']=[-.65*reach,0,0]
  if clip=='interact':
   p['head']=[.025*fade,-.08*fade,0];p['neck']=[0,-.02*fade,0]
   if not quad:p['upper_arm.L']=[-.23*fade,0,.09*fade];p['forearm.L']=[-.55*fade,0,0]
 return p

def face_at(clip,t):
 shapes={'smile':0.,'frown':0.,'brow_up':0.,'brow_down':0.,'squint':0.,'eye_wide':0.}
 if clip in ('laugh','interact'):shapes.update(smile=.65 if clip=='laugh' else .30,squint=.18)
 if clip=='cry':shapes.update(frown=.65,brow_up=.35,squint=.28)
 if clip=='surprise':shapes.update(brow_up=.75,eye_wide=.65)
 if clip=='fear':shapes.update(frown=.28,brow_up=.50,eye_wide=.3)
 return shapes

def _foot_heading_raw(actor,foot,t):
 """Lock sole rotation during support, while the body may turn above it."""
 a=active_action(actor,t);kind=a['clip']
 turn_steps=kind=='turn' and foot.get('foot','').startswith(('forepaw','hindpaw'))
 if kind in ('walk','run') or turn_steps:
  phase_offset={'forepaw.L':0.,'forepaw.R':.5,'hindpaw.L':.75,'hindpaw.R':.25}.get(foot.get('foot'),foot['phase']) if kind=='walk' or turn_steps else foot['phase'];cycle=.55 if turn_steps else a.get('cycle_seconds',CATALOG[kind]['seconds']);phase=(t-a['start'])/cycle+phase_offset;k=math.floor(phase);u=phase-k;stance=.58 if turn_steps else CATALOG[kind]['stance'];contact=a['start']+(k-phase_offset)*cycle
  y0=root_at(actor,max(a['start'],min(a['end']-1e-6,contact+cycle*stance*.5)))[1]
  if contact<=a['start']+1e-8:y0=foot_heading(actor,foot,a['start']-1/24)
  y1=root_at(actor,max(a['start'],min(a['end']-1e-6,contact+cycle*(1+stance*.5))))[1]
  return y0 if u<stance else y0+((y1-y0+math.pi)%math.tau-math.pi)*smooth((u-stance)/(1-stance))
 if kind=='turn':
  half=(a['end']-a['start'])/2;start=a['start']+(0 if foot['phase']<.5 else half);end=start+half;y0=root_at(actor,a['start'])[1];y1=root_at(actor,a['end']-1e-6)[1]
  return y0+((y1-y0+math.pi)%math.tau-math.pi)*smooth((t-start)/half)
 prior=next((step for step in sorted(actor.get('actions',[]),key=lambda step:step['end'],reverse=True) if step['end']<=t and step['clip'] in ('walk','run','turn','jump')),None)
 return _foot_heading_raw(actor,foot,prior['end']-1e-7) if prior else root_at(actor,t)[1]


def foot_heading(actor,foot,t):
 """Blend into a new clip without snapping the sole at the first frame."""
 yaw=_foot_heading_raw(actor,foot,t);a=active_action(actor,t);elapsed=t-a['start']
 if a['start']>0 and 0<=elapsed<.16 and a['clip'] in ('walk','run','turn','jump'):
  old=foot_heading(actor,foot,a['start']-1/24)
  yaw=old+((yaw-old+math.pi)%math.tau-math.pi)*smooth(elapsed/.16)
 return yaw

def support_shift(actor,t):
 """Continuous pelvis support in bind-space, shared by all character rigs."""
 a=active_action(actor,t);kind=a['clip'];elapsed=t-a['start'];duration=a['end']-a['start'];phase=math.tau*elapsed/CATALOG[kind]['seconds'];q=[0.,0.,0.]
 if kind in ('walk','run'):q=[.004*math.sin(phase),0.,(-.015 if kind=='walk' else -.026)+.002*math.cos(phase*2)]
 if kind=='turn':q[2]=-.035*math.sin(math.pi*elapsed/duration)**2
 if kind=='jump':q[2]=.22*math.sin(math.pi*elapsed/duration)**2
 if kind=='sit':q[2]=-.11*smooth(elapsed/duration)
 if kind=='pickup' and 'body_lower' in a:q[2]=-a['body_lower']*smooth(elapsed/1.2)*(1-smooth((elapsed-duration+1.5)/1.5))
 if a['start']>0 and 0<=elapsed<.16:q=lerp(support_shift(actor,a['start']-1/24),q,smooth(elapsed/.16))
 return q
