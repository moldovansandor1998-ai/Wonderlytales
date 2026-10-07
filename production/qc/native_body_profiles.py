import numpy as np
def profiles(code):
    bones=[]
    def bone(name,head,tail,parent=None):bones.append((name,np.array(head),np.array(tail),parent))
    bone('root',(0,0,0),(0,0,.1))
    if code=='CHAR_MARK':
     bone('pelvis',(0,0,.43),(0,0,.5),'root');bone('spine',(0,0,.5),(0,0,.64),'pelvis');bone('chest',(0,0,.64),(0,0,.72),'spine');bone('neck',(0,0,.72),(0,0,.77),'chest');bone('head',(0,0,.77),(0,0,.96),'neck')
     for side,sign in [('L',1),('R',-1)]:
      bone('upper_arm.'+side,(sign*.13,0,.69),(sign*.175,0,.57),'chest');bone('forearm.'+side,(sign*.175,0,.57),(sign*.195,0,.46),'upper_arm.'+side);bone('hand.'+side,(sign*.195,0,.46),(sign*.20,0,.395),'forearm.'+side)
      bone('thigh.'+side,(sign*.067,0,.44),(sign*.07,0,.26),'pelvis');bone('shin.'+side,(sign*.07,0,.26),(sign*.075,0,.09),'thigh.'+side);bone('foot.'+side,(sign*.075,0,.09),(sign*.075,-.09,.035),'shin.'+side)
    elif code=='CHAR_LILI':
     bone('pelvis',(0,.13,.22),(0,.08,.32),'root');bone('spine',(0,.08,.32),(0,-.05,.4),'pelvis');bone('neck',(0,-.05,.4),(0,-.065,.55),'spine');bone('head',(0,-.065,.55),(0,-.065,.86),'neck')
     bone('tail_01',(0,.15,.25),(.16,.23,.28),'pelvis');bone('tail_02',(.16,.23,.28),(.27,.24,.45),'tail_01');bone('tail_03',(.27,.24,.45),(.28,.22,.64),'tail_02')
     for side,sign in [('L',1),('R',-1)]:
      bone('foreleg.'+side,(sign*.1,-.06,.38),(sign*.1,-.09,.15),'spine');bone('forepaw.'+side,(sign*.1,-.09,.15),(sign*.1,-.14,.04),'foreleg.'+side)
      bone('hindleg.'+side,(sign*.13,.12,.22),(sign*.13,.08,.08),'pelvis');bone('hindpaw.'+side,(sign*.13,.08,.08),(sign*.13,-.02,.04),'hindleg.'+side)
    elif code in ('CHAR_MORZSI','CHAR_POTTY','CHAR_ZIZI'):
     if code=='CHAR_MORZSI': hip,chest,neck,head,top,width=.34,.58,.63,.67,.94,.20
     elif code=='CHAR_POTTY': hip,chest,neck,head,top,width=.20,.37,.43,.47,.65,.10
     else: hip,chest,neck,head,top,width=.36,.59,.65,.69,.91,.13
     bone('pelvis',(0,0,hip),(0,0,hip+.08),'root');bone('spine',(0,0,hip+.08),(0,0,chest),'pelvis');bone('chest',(0,0,chest),(0,0,neck),'spine');bone('neck',(0,0,neck),(0,0,head),'chest');bone('head',(0,0,head),(0,0,top),'neck')
     for side,sign in [('L',1),('R',-1)]:
      bone('upper_arm.'+side,(sign*width,0,chest),(sign*(width+.06),0,chest-.10),'chest');bone('forearm.'+side,(sign*(width+.06),0,chest-.10),(sign*(width+.09),0,chest-.20),'upper_arm.'+side);bone('hand.'+side,(sign*(width+.09),0,chest-.20),(sign*(width+.09),0,chest-.25),'forearm.'+side)
      bone('thigh.'+side,(sign*width*.5,0,hip),(sign*width*.5,0,hip*.55),'pelvis');bone('shin.'+side,(sign*width*.5,0,hip*.55),(sign*width*.55,0,.055),'thigh.'+side);bone('foot.'+side,(sign*width*.55,0,.055),(sign*width*.55,-.10,.025),'shin.'+side)
     if code=='CHAR_POTTY':
      for side,sign in [('L',1),('R',-1)]:
       bone('ear_base.'+side,(sign*.09,0,.62),(sign*.14,0,.78),'head');bone('ear_tip.'+side,(sign*.14,0,.78),(sign*.17,0,.96),'ear_base.'+side)
      bone('tail_01',(0,.14,.22),(0,.24,.23),'pelvis')
     if code=='CHAR_ZIZI':
      bone('tail_01',(0,.15,.37),(.14,.25,.38),'pelvis');bone('tail_02',(.14,.25,.38),(.30,.26,.49),'tail_01');bone('tail_03',(.30,.26,.49),(.37,.24,.63),'tail_02')
    elif code=='CHAR_BOGYO':
     bone('pelvis',(0,.16,.28),(0,.10,.36),'root');bone('spine',(0,.10,.36),(0,-.15,.42),'pelvis');bone('neck',(0,-.15,.42),(0,-.18,.58),'spine');bone('head',(0,-.18,.58),(0,-.18,.92),'neck')
     bone('tail_01',(0,.22,.35),(.12,.29,.44),'pelvis');bone('tail_02',(.12,.29,.44),(.20,.30,.62),'tail_01');bone('tail_03',(.20,.30,.62),(.18,.28,.79),'tail_02')
     for side,sign in [('L',1),('R',-1)]:
      bone('foreleg.'+side,(sign*.13,-.16,.39),(sign*.13,-.17,.14),'spine');bone('forepaw.'+side,(sign*.13,-.17,.14),(sign*.13,-.24,.035),'foreleg.'+side)
      bone('hindleg.'+side,(sign*.14,.17,.26),(sign*.14,.15,.09),'pelvis');bone('hindpaw.'+side,(sign*.14,.15,.09),(sign*.14,.05,.035),'hindleg.'+side)
      bone('ear.'+side,(sign*.18,-.15,.85),(sign*.27,-.15,.63),'head')
    else:
     raise ValueError('No native body profile for character')
    return bones
