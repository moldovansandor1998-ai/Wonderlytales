"""Reachable body support without stretching legs or moving planted targets."""
import math

def fit_support(hips,targets,lengths,margin=.985,iterations=80):
 centers=[[t-h for t,h in zip(target,hip)] for hip,target in zip(hips,targets)];radii=[length*margin for length in lengths];shift=[0.,0.,0.]
 for _ in range(iterations):
  previous=shift[:]
  for center,radius in zip(centers,radii):
   delta=[s-c for s,c in zip(shift,center)];distance=math.sqrt(sum(v*v for v in delta))
   if distance>radius:shift=[c+d*radius/distance for c,d in zip(center,delta)]
  if sum((a-b)**2 for a,b in zip(shift,previous))<1e-12:break
 residual=max((math.sqrt(sum((s-c)**2 for s,c in zip(shift,center)))-radius for center,radius in zip(centers,radii)),default=0)
 return shift,max(0,residual)
