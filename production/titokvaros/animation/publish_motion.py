"""Publish real native walk/run Action assets, separate from film performances.
These are development motion cycles; physical/acting approval is still pending.
"""
import bpy,sys,argparse,json,hashlib,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from motion_library import locomotion
p=argparse.ArgumentParser();p.add_argument('--libraries',required=True);p.add_argument('--out',required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.libraries);out=Path(a.out);out.mkdir(exist_ok=True,parents=True);report=[]
for code in ['MIRA','BRUNO','KIPP']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 with bpy.data.libraries.load(str(source/f'TV_CHAR_{code}_V001.blend'),link=False) as (src,dst):dst.collections=['TV_CHAR_'+code]
 bpy.context.scene.collection.children.link(dst.collections[0]);rig=bpy.data.objects['TV_CHAR_'+code+'_RIG'];rig.animation_data_create();actions=set()
 for mode,cycle_frames,stride in [('walk',24,.48),('run',12,.72)]:
  rig.animation_data.action=None
  for f in range(1,cycle_frames+2):
   t=(f-1)/24;distance=stride*(f-1)/cycle_frames;rig.location=(0,-distance,0)
   locomotion(rig,f,t,distance,stride/(cycle_frames/24),mode)
  act=rig.animation_data.action;act.name=f'TV_{code}_{mode.upper()}_ROOTMOTION_V001';act.use_fake_user=True;act.asset_mark();act.asset_data.description='Development cycle; requires retargeting and visual performance approval.';act['production_approved']=False;act['stride_m']=stride;act['cycle_frames']=cycle_frames;act['fps']=24;actions.add(act)
  report.append({'character':code,'action':act.name,'cycle_frames':cycle_frames,'stride_m':stride,'root_motion':True,'production_approved':False})
 path=out/f'TV_MOTION_{code}_V001.blend';bpy.data.libraries.write(str(path),actions,fake_user=True,compress=True)
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):
  if not all(x.name in src.actions for x in actions):raise RuntimeError('Missing motion action')
 for r in report:
  if r['character']==code:r.update(file=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,reload_manifest_verified=True)
(out/'motion_library_manifest.json').write_text(json.dumps({'stage':'DEVELOPMENT','production_approved':False,'actions':report},indent=2)+'\n');print(json.dumps({'actions':len(report),'production_approved':False}))
