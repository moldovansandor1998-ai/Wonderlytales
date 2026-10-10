"""Resumable review production: render one bounded job, verify, commit queue.
Native final lighting requires a Cycles adapter; this runner is a review worker.
"""
import argparse,json,subprocess,time,wave,hashlib
from pathlib import Path
from .spec import compile_episode,atomic_json,digest
from .jobs import RenderQueue
from .media import verify_video,assemble,mix_scene
from .release import release_gate

def run_leased(command,queue,job):
 process=subprocess.Popen(command);last=time.time()
 try:
  while process.poll() is None:
   if time.time()-last>30:queue.heartbeat(job,lease_seconds=180);last=time.time()
   time.sleep(1)
  if process.returncode:raise subprocess.CalledProcessError(process.returncode,command)
 except BaseException:
  process.terminate();process.wait();raise

def run(args):
 if args.max_jobs is not None and (args.max_jobs<1 or not args.worker_only):raise ValueError('--max-jobs requires --worker-only and a positive job count')
 completed=0
 root=Path(args.project).resolve();registry=root/args.registry;episode=json.loads((root/args.episode).read_text());
 scripts=Path(__file__).parent.resolve();episode['renderer_sha256']=hashlib.sha256(''.join(digest(scripts/name) for name in ['render_review.py','review_server.py','quality.py']).encode()).hexdigest()
 for scene in episode['scenes']:scene['compiled_scene_sha256']=digest(root/(scene['id']+'.blend'))
 plan=compile_episode(episode,json.loads(registry.read_text()),max_job_frames=args.chunk);atomic_json(root/'render_plan_V021.json',plan);queue=RenderQueue(root/'render_queue.sqlite');queue.enqueue(plan['jobs']);queue.recover_corrupt_outputs({j['id'] for j in plan['jobs']});scripts=Path(__file__).parent.resolve();outdir=root/'render_jobs';outdir.mkdir(exist_ok=True)
 while True:
  job=queue.claim(lease_seconds=180,allowed_ids={j['id'] for j in plan['jobs']})
  if not job:
   active=queue.summary({j['id'] for j in plan['jobs']})
   if not args.worker_only and (active.get('RUNNING') or active.get('PENDING')):time.sleep(2);continue
   break
  p=job['payload'];scene=root/(p['scene_id']+'.blend');out=outdir/(job['id']+'.mp4')
  try:
   compiled=json.loads(scene.with_suffix('.compiled.json').read_text())
   if compiled['master_sha256']!=next(iter(p['assets'].values())):raise ValueError('Compiled scene uses a different frozen master')
   if digest(scene)!=p['compiled_scene_sha256'] or p['compiled_scene_sha256']!=compiled['scene_sha256']:raise ValueError('Compiled native scene file changed')
   run_leased([args.blender,'-b','-t','4','--python-exit-code','1','--python',str(scripts/'render_review.py'),'--',str(scene),str(registry),str(out),args.python,str(p['frame_start']),str(p['frame_end'])],queue,job);verified=verify_video(out,p['frames']);queue.finish(job,out,verified);print('JOB_DONE',job['id'],queue.summary({j['id'] for j in plan['jobs']}),flush=True)
   completed+=1
   if args.max_jobs is not None and completed>=args.max_jobs:break
  except Exception as error:
   queue.fail(job,error)
   if job['attempt']>=3:raise
   time.sleep(min(10,2**job['attempt']))
 if args.worker_only:return queue.summary({j['id'] for j in plan['jobs']})
 outputs=queue.outputs(plan['jobs']);audio=root/'episode_mix_V021.wav';scene_checks={}
 for scene_data in episode['scenes']:
  scene=root/(scene_data['id']+'.blend');check=root/(scene_data['id']+'.timing_QC.json')
  subprocess.run([args.blender,'-b','-t','2','--python-exit-code','1','--python',str(scripts/'tests/audit_native_scene.py'),'--',str(scene),str(registry),str(check),str(args.chunk)],check=True)
  scene_checks[scene_data['id']]=json.loads(check.read_text())
 with wave.open(str(audio),'wb') as out:
  out.setnchannels(2);out.setsampwidth(2);out.setframerate(48000)
  for scene_data in episode['scenes']:
   script=root/(scene_data['id']+'.script.json');atomic_json(script,scene_data);stem=root/(scene_data['id']+'.mix.wav');mix_scene(script,root/(scene_data['id']+'.compiled.json'),stem)
   with wave.open(str(stem),'rb') as source:out.writeframes(source.readframes(source.getnframes()))
 result=assemble(queue,plan['jobs'],root/args.output,audio=audio);qcs={j['id']:json.loads((outdir/(j['id']+'.qc.json')).read_text()) for j in plan['jobs']}
 for name,check in scene_checks.items():qcs[name+'::timing']={'structural_qc_pass':check['sampled_jaw_drivers_pass'] and check['render_boundaries_pass'],'engine':'BLENDER_NATIVE_TIMING_AUDIT','artist_approved':False}
 gate=release_gate(json.loads(registry.read_text()),qcs,result);atomic_json(root/'assembly_QC_V021.json',{'media':result,'queue':queue.summary({j['id'] for j in plan['jobs']}),'job_count':len(outputs),'native_scene_timing':scene_checks,'release_gate':gate,'professional_quality_approved':False});return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--project',required=True);p.add_argument('--registry',default='asset_registry_V021.json');p.add_argument('--episode',required=True);p.add_argument('--blender',required=True);p.add_argument('--python',required=True);p.add_argument('--chunk',type=int,default=360);p.add_argument('--output',default='review_assembled.mp4');p.add_argument('--worker-only',action='store_true');p.add_argument('--max-jobs',type=int);run(p.parse_args())
