"""One shared walk/run/turn/contact diagnostic for all six existing characters."""
import json,math,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'production'))
from animation_system.spec import CAST,validate_scene
registry=json.loads((root/'data/V024/asset_registry_V024b.json').read_text())
actors=[]
for i,code in enumerate(CAST):
    x=-3.75+i*1.5
    actors.append(dict(code=code,version=registry['characters'][code]['version'],position=[x,0,0],yaw=0,actions=[
        dict(clip='walk',start=0,end=4,destination=[x,-1,0]),
        dict(clip='turn',start=4,end=6,yaw=math.pi/2),
        dict(clip='run',start=6,end=9,destination=[x+1,-1,0]),
        dict(clip='turn',start=9,end=11,yaw=0),
        dict(clip='interact',start=12,end=15),dict(clip='surprise',start=15,end=17),dict(clip='laugh',start=17,end=20)],gaze=[]))
scene=dict(schema='WONDERLY_SCENE_V1',id='CAST_MOTION_V024',fps=24,duration=20,location='LOC_FOREST_V021',studio=True,characters=actors,dialogue=[],cameras=[dict(start=0,position=[7,-13,7],target=[.4,-.5,.75],lens=42)],interactions=[],production_approved=False,scope='Native all-cast locomotion and face mechanics; not spoken acting approval')
validate_scene(scene,registry)
out=root/'production/episodes/S1E1/quality/cast_motion_V024.script.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(scene,ensure_ascii=False,indent=2)+'\n');print(out)
