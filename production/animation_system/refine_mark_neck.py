"""Continuous head/neck bind gradient; preserve native morph keys and seam map."""
import bpy,sys,json,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import smooth,digest,atomic_json

def refine(body,patch):
 groups={g.name:g for g in body.vertex_groups};changed=0
 for v in body.data.vertices:
  z=v.co.z
  if z<.685:continue
  old={body.vertex_groups[g.group].name:g.weight for g in v.groups};locked={n:w for n,w in old.items() if n.startswith(('ear','tail'))};available=sum(old.values())-sum(locked.values())
  head=smooth((z-.715)/.04);neck=(1-head)*smooth((z-.685)/.03);chest=1-head-neck
  arm=smooth((abs(v.co.x)-.125)/.065)*(1-smooth((z-.73)/.025))
  binding={n:w*arm for n,w in old.items() if n not in locked};binding['head']=binding.get('head',0)+available*head*(1-arm);binding['neck']=binding.get('neck',0)+available*neck*(1-arm);binding['chest']=binding.get('chest',0)+available*chest*(1-arm)
  for n in old:
   if n not in locked:groups[n].remove([v.index])
  for n,w in binding.items():
   if w>1e-8:groups[n].add([v.index],w,'REPLACE')
  changed+=1
 N=int(patch['ring_vertices']);R=len(patch.data.vertices)//N;ids=list(patch['seam_body_indices']);pg={g.name:g for g in patch.vertex_groups}
 for i,v in enumerate(patch.data.vertices):
  f=(i//N)/(R-1);j=i%N;b=body.data.vertices[ids[j]];outer={body.vertex_groups[g.group].name:g.weight for g in b.groups};a=math.atan2((b.co.z-.769)/.021,(b.co.x+.021)/.044);jaw=smooth(-math.sin(a))*.82*(1-f)**3;blend=smooth(f/.65);binding={n:w*blend for n,w in outer.items()};binding['head']=binding.get('head',0)+(1-jaw)*(1-blend);binding['jaw']=binding.get('jaw',0)+jaw*(1-blend)
  for g in list(v.groups):patch.vertex_groups[g.group].remove([i])
  for n,w in binding.items():
   if n not in pg:pg[n]=patch.vertex_groups.new(name=n)
   if w>1e-8:pg[n].add([i],w,'REPLACE')
 return {'upper_body_vertices_rebound':changed,'head_gradient_z':[.715,.755],'morph_keys_preserved':True,'boundary_weights_copied':N}

def main(source,registry_path):
 bpy.ops.wm.open_mainfile(filepath=str(source),use_scripts=False);p=bpy.data.objects['CHAR_MARK_FACIAL_TOPOLOGY'];b=bpy.data.objects[p['seam_body']];report=refine(b,p);bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True);reg=json.loads(registry_path.read_text());sha=digest(source)
 for asset in list(reg['characters'].values())+list(reg['locations'].values()):asset['asset_sha256']=sha
 reg['characters']['CHAR_MARK']['continuous_neck_binding']=report;atomic_json(registry_path,reg);atomic_json(source.parent/'neck_authoring_V022.json',report);print('NECK_REBOUND',report,flush=True)
if __name__=='__main__':main(*map(lambda p:Path(p).resolve(),sys.argv[sys.argv.index('--')+1:]))
