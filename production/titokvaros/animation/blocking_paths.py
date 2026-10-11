"""Shared authored trajectories, in world metres; positive travel goes down -Y."""
def hero_path(t):
 if t<5:return 2.0-.55*t,.55,'walk',.55*t
 if t<18:return -.75,0,'idle',2.75
 if t<24:
  u=t-18;dist=.6*u+.07*u*u;return -.75-dist,.6+.14*u,'run',2.75+dist
 return -6.87,0,'idle',8.87

def cargo_path(t):
 u=max(0,min(1,(t-15)/9));e=u*u*(3-2*u)
 # Start ahead of the heroes in a separate lane; they catch the cart.
 # The old rear-to-front route overtook and penetrated Bruno's torso.
 return (2.8-2.45*e,-2.6-5.15*e,0)
