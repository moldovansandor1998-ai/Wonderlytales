import unittest,math
from animation_system.motion import foot_at,foot_heading
from animation_system.performance import blink_times,blink_value,listener_response

class V025TemporalTests(unittest.TestCase):
 def test_walking_stop_keeps_both_support_feet_fixed(self):
  for duration in (1.1,2.3,5.0,6.0):
   actor={'position':[0,0,0],'actions':[{'clip':'walk','start':0,'end':duration,'destination':[0,-.4,0]},{'clip':'talk','start':duration,'end':duration+2}]}
   for phase in (0,.25,.5,.75):
    foot={'ankle':[.1,0,.05],'phase':phase,'leg_length':.3}
    before=foot_at(actor,foot,duration-1e-5)[0]
    stop=foot_at(actor,foot,duration)[0]
    self.assertLess(math.dist(before,stop),1e-5)
    self.assertAlmostEqual(stop[2],.05,places=7)
    for t in (duration+.04,duration+.12,duration+1.8):
     self.assertEqual(foot_at(actor,foot,t)[0],stop)
     self.assertTrue(foot_at(actor,foot,t)[1])
     self.assertEqual(foot_heading(actor,foot,t),foot_heading(actor,foot,duration))
 def test_turn_starts_on_the_footprints_left_by_walk(self):
  actor={'position':[0,0,0],'actions':[{'clip':'walk','start':0,'end':2.3,'destination':[0,-.4,0]},{'clip':'turn','start':2.3,'end':4.3,'yaw':1.5}]}
  foot={'ankle':[.1,0,.05],'phase':.5,'leg_length':.3}
  a=foot_at(actor,foot,2.3-1e-7)[0];b=foot_at(actor,foot,2.6)[0]
  self.assertLess(math.dist(a,b),1e-8)
 def test_full_blink_closure_at_native_24fps(self):
  peaks=blink_times(60,123)
  self.assertEqual(peaks,blink_times(60,123))
  self.assertTrue(all(b-a>1.35 for a,b in zip(peaks,peaks[1:])))
  for peak in peaks:
   for side in ('L','R'):
    samples=[blink_value(peak+i/24,peaks,side) for i in range(-4,7)]
    self.assertEqual(max(samples),1.)
    self.assertEqual(samples[0],0.);self.assertEqual(samples[-1],0.)
    self.assertTrue(all(0<=v<=1 for v in samples))
 def test_only_attended_partner_gets_a_delayed_response(self):
  s={'characters':[{'code':'A','gaze':[{'start':0,'end':10,'target':'B'}]}],'dialogue':[{'speaker':'B','start':1,'end':3}]}
  self.assertEqual(listener_response(s,'A',3.1)['head_pitch'],0)
  self.assertGreater(listener_response(s,'A',3.6)['head_pitch'],0)
  s['dialogue'].append({'speaker':'A','start':3.3,'end':4})
  self.assertEqual(listener_response(s,'A',3.6)['head_pitch'],0)
  s['dialogue']= [{'speaker':'C','start':1,'end':3}]
  self.assertEqual(listener_response(s,'A',3.6)['head_pitch'],0)
if __name__=='__main__':unittest.main()
