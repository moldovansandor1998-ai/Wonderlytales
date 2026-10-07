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
    else:
     bone('pelvis',(0,.13,.22),(0,.08,.32),'root');bone('spine',(0,.08,.32),(0,-.05,.4),'pelvis');bone('neck',(0,-.05,.4),(0,-.065,.55),'spine');bone('head',(0,-.065,.55),(0,-.065,.86),'neck')
     bone('tail_01',(0,.15,.25),(.16,.23,.28),'pelvis');bone('tail_02',(.16,.23,.28),(.27,.24,.45),'tail_01');bone('tail_03',(.27,.24,.45),(.28,.22,.64),'tail_02')
     for side,sign in [('L',1),('R',-1)]:
      bone('foreleg.'+side,(sign*.1,-.06,.38),(sign*.1,-.09,.15),'spine');bone('forepaw.'+side,(sign*.1,-.09,.15),(sign*.1,-.14,.04),'foreleg.'+side)
      bone('hindleg.'+side,(sign*.13,.12,.22),(sign*.13,.08,.08),'pelvis');bone('hindpaw.'+side,(sign*.13,.08,.08),(sign*.13,-.02,.04),'hindleg.'+side)
    return bones
