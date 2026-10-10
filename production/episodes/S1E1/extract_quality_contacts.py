"""Read native foot-control landings without mutating the authored scene."""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector
root=Path(sys.argv[sys.argv.index('--')+1]);out=root/'episode-v018';bpy.ops.wm.open_mainfile(filepath=str(out/'CSODAKAPU_60S_NATIVE_V018.blend'),use_scripts=False)
contacts=[]
for control in bpy.context.scene.objects:
 if '_V018_PLANT_' not in control.name or not control.animation_data:continue
 action=control.animation_data.action;curves=[action.fcurves.find('location',index=i) for i in range(3)]
 if not all(curves):continue
 frames=list(range(1,337,2));points=[Vector([fc.evaluate(frame) for fc in curves]) for frame in frames]
 for i in range(1,len(points)-1):
  if (points[i+1]-points[i]).length<.00002 and points[i-1].z-points[i].z>.004:
   contacts.append({'character':control.name.split('_V018_PLANT_')[0],'foot':control.name.split('_V018_PLANT_')[1],'frame':frames[i],'time_sec':(frames[i]-1)/24,'position_m':list(points[i])})
(out/'quality_test_foot_contacts_V018.json').write_text(json.dumps({'method':'authored foot target landing into stationary stance; visual sole validation pending','events':sorted(contacts,key=lambda c:c['frame'])},indent=2))
print('FOOT_CONTACT_EVENTS',len(contacts),flush=True)
