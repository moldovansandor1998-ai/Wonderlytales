import unittest,tempfile,json,copy,concurrent.futures,sqlite3,shutil
from pathlib import Path
from animation_system.spec import compile_episode,validate_scene
from animation_system.jobs import RenderQueue
from animation_system.motion import foot_at,root_at,foot_heading,support_shift
from animation_system.lipsync import aligned_cues,weights_at,viseme,validate_track
from animation_system.release import release_gate

class SystemTests(unittest.TestCase):
 def test_verified_render_cache_can_move_with_project(self):
  with tempfile.TemporaryDirectory() as directory:
   old=Path(directory)/'old';new=Path(directory)/'new';old.mkdir();(old/'render_jobs').mkdir()
   queue=RenderQueue(old/'render_queue.sqlite');payload={'id':'one','frames':2};queue.enqueue([payload]);lease=queue.claim();file=old/'render_jobs/one.mp4';file.write_bytes(b'verified fixture');queue.finish(lease,file,{'decoded':True,'frames':2})
   shutil.copytree(old,new);shutil.rmtree(old);moved=RenderQueue(new/'render_queue.sqlite')
   self.assertEqual(moved.recover_corrupt_outputs(),[]);self.assertEqual(moved.outputs([payload]),[(new/'render_jobs/one.mp4').resolve()])
   (new/'render_jobs/one.mp4').write_bytes(b'corrupt');self.assertEqual(moved.recover_corrupt_outputs(),['one'])
 def test_queue_connections_close_at_end_of_transaction_scope(self):
  with tempfile.TemporaryDirectory() as directory:
   queue=RenderQueue(Path(directory)/'queue.sqlite')
   with queue.connect() as connection:connection.execute('SELECT 1')
   with self.assertRaises(sqlite3.ProgrammingError):connection.execute('SELECT 1')
 def setUp(self):
  self.reg={'characters':{'CHAR_MARK':{'version':'V021','asset_sha256':'a'*64}},'locations':{'FOREST':{'asset_sha256':'b'*64}}};self.scene={'schema':'WONDERLY_SCENE_V1','id':'s0','fps':24,'duration':12,'location':'FOREST','characters':[{'code':'CHAR_MARK','version':'V021','position':[0,0,0],'actions':[]}],'cameras':[{'start':0,'position':[0,-5,2],'target':[0,0,1]}]}
 def episode(self,n,duration):
  scenes=[]
  for i in range(n):s=copy.deepcopy(self.scene);s.update(id=f's{i}',duration=duration);scenes.append(s)
  return {'schema':'WONDERLY_EPISODE_V1','id':'feature','kind':'film','target_duration_seconds':n*duration,'scenes':scenes}
 def test_cached_trial_alignment_is_bounded_and_never_certifies_phonetics(self):
  track={'method':'CACHED_RHUBARB_V020_DEVELOPMENT','duration':1.9,'phoneme_boundaries_verified':False,'mouthCues':[{'start':0,'end':1.9,'value':'B'}]}
  self.assertEqual(validate_track(track),track)
  for change in [lambda t:t.update(phoneme_boundaries_verified=True),lambda t:t.update(duration=float('nan')),lambda t:t['mouthCues'][0].update(end=2.0),lambda t:t['mouthCues'][0].update(value='INVALID')]:
   bad=copy.deepcopy(track);change(bad)
   with self.assertRaises(ValueError):validate_track(bad)
 def test_real_40_and_60_minute_frame_coverage(self):
  for n,d in [(200,12),(300,12),(400,9)]:
   plan=compile_episode(self.episode(n,d),self.reg,max_job_frames=120);cursor=1
   for j in plan['jobs']:self.assertEqual(j['episode_start_frame'],cursor);cursor+=j['frames']
   self.assertEqual(cursor-1,n*d*24);self.assertEqual(plan['duration_seconds'],n*d)
 def test_short_story_cannot_claim_feature(self):
  with self.assertRaises(ValueError):compile_episode(self.episode(100,12),self.reg)
 def test_invalid_contracts(self):
  for change in [lambda s:s.update(duration=float('nan')),lambda s:s['characters'][0].update(version='V020'),lambda s:s['characters'][0].update(actions=[{'clip':'wave_magic','start':0,'end':2}]),lambda s:s['characters'][0].update(actions=[{'clip':'walk','start':0,'end':2}]),lambda s:s.update(cameras=[]),lambda s:s.update(dialogue=[{'speaker':'CHAR_MORZSI','start':0,'end':2,'audio':'a','visemes':'v'}])]:
   s=copy.deepcopy(self.scene);change(s)
   with self.assertRaises(ValueError):validate_scene(s,self.reg)
 def test_asset_change_invalidates_cache(self):
  e=self.episode(200,12);a=compile_episode(e,self.reg);self.reg['characters']['CHAR_MARK']['asset_sha256']='c'*64;b=compile_episode(e,self.reg);self.assertNotEqual(a['jobs'][0]['id'],b['jobs'][0]['id'])
 def test_renderer_change_invalidates_cache(self):
  e=self.episode(200,12);e['renderer_sha256']='a'*64;a=compile_episode(e,self.reg);e['renderer_sha256']='b'*64;b=compile_episode(e,self.reg);self.assertNotEqual(a['jobs'][0]['id'],b['jobs'][0]['id'])
 def test_queue_connections_close_and_commit_on_scope_exit(self):
  import sqlite3
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db')
   with q.connect() as db:db.execute("INSERT INTO events(job,at,status,detail) VALUES('probe',0,'TEST','committed')")
   with self.assertRaises(sqlite3.ProgrammingError):db.execute('SELECT 1')
   with q.connect() as reopened:self.assertEqual(reopened.execute("SELECT detail FROM events WHERE job='probe'").fetchone()[0],'committed')
 def test_planted_feet_stay_put_as_body_moves(self):
  actor={'position':[0,0,0],'actions':[{'clip':'walk','start':0,'end':5,'destination':[0,-2,0]}]};foot={'ankle':[.1,0,.1],'phase':0};a=foot_at(actor,foot,1.0);b=foot_at(actor,foot,1.2);self.assertTrue(a[1] and b[1]);self.assertEqual(a[2],b[2]);self.assertEqual(a[0],b[0]);self.assertNotEqual(root_at(actor,1)[0],root_at(actor,1.2)[0])
 def test_atomic_claim_resume_stale_worker_and_tamper(self):
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db');job={'id':'one','frames':2};q.enqueue([job]);q.enqueue([job])
   with concurrent.futures.ThreadPoolExecutor(2) as pool:claims=list(pool.map(lambda _:q.claim(now=10,lease_seconds=1),range(2)))
   old=next(c for c in claims if c);self.assertEqual(sum(c is not None for c in claims),1);q=RenderQueue(Path(d)/'q.db');new=q.claim(now=12);self.assertEqual(new['attempt'],2)
   out=Path(d)/'clip.mp4';out.write_bytes(b'tested fixture')
   with self.assertRaises(RuntimeError):q.finish(old,out,{'decoded':True,'frames':2})
   with self.assertRaises(ValueError):q.finish(new,out,{'decoded':False,'frames':2})
   q.finish(new,out,{'decoded':True,'frames':2});self.assertEqual(q.outputs([job]),[out]);out.write_bytes(b'tampered')
   with self.assertRaises(RuntimeError):q.outputs([job])
 def test_retry_limit_and_immutable_jobs(self):
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db');q.enqueue([{'id':'one','frames':2}])
   with self.assertRaises(ValueError):q.enqueue([{'id':'one','frames':3}])
   for t in [10,20,30]:j=q.claim(now=t);q.fail(j,'simulated crash',now=t)
   self.assertEqual(q.summary(),{'FAILED':1});self.assertIsNone(q.claim(now=100))
 def test_hungarian_digraph_timing_and_silence(self):
  r={'language':'hun','audio_sha256':'a'*64,'textMatches':True,'transcript':'gyú','words':[{'type':'word','text':'gyú','start':.2,'end':.6,'characters':[{'text':'g','start':.2,'end':.3},{'text':'y','start':.3,'end':.4},{'text':'ú','start':.4,'end':.6}]}]};track=aligned_cues(r,'gyú',1,'a'*64);self.assertTrue(any(c['phone']=='gy' for c in track['mouthCues']));self.assertEqual(weights_at(track,.1)['X'],1)
  for t in [.1,.3,.4,.5,.7,1]:self.assertAlmostEqual(sum(weights_at(track,t).values()),1)
  with self.assertRaises(ValueError):aligned_cues(r,'más',1,'a'*64)
 def test_encoded_preview_cannot_pass_release(self):
  result=release_gate(self.reg,{'scene':{'engine':'BLENDER_EVALUATED_GEOMETRY_GL_PREVIEW','structural_qc_pass':False}},{'decoded':True});self.assertFalse(result['approved']);self.assertEqual(len(result['reasons']),4)
 def test_missing_cached_output_is_rerendered(self):
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db');q.enqueue([{'id':'one','frames':2}]);job=q.claim();file=Path(d)/'output.mp4';file.write_bytes(b'fixture');q.finish(job,file,{'decoded':True,'frames':2});file.unlink();self.assertEqual(q.recover_corrupt_outputs(),['one']);self.assertEqual(q.claim()['attempt'],1)
 def test_changed_plan_does_not_claim_obsolete_job(self):
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db');q.enqueue([{'id':'old','frames':2},{'id':'new','frames':2}]);self.assertEqual(q.claim(allowed_ids={'new'})['id'],'new');self.assertEqual(q.summary({'new'}),{'RUNNING':1})
 def test_cache_recovery_only_touches_current_plan(self):
  with tempfile.TemporaryDirectory() as d:
   q=RenderQueue(Path(d)/'q.db');q.enqueue([{'id':'old','frames':2},{'id':'new','frames':2}]);file=Path(d)/'output.mp4';file.write_bytes(b'fixture')
   for _ in range(2):
    job=q.claim();q.finish(job,file,{'decoded':True,'frames':2})
   file.unlink();self.assertEqual(q.recover_corrupt_outputs({'new'}),['new']);self.assertEqual(q.summary({'old'}),{'DONE':1});self.assertEqual(q.summary({'new'}),{'PENDING':1})
 def test_turn_locks_support_foot_position_and_orientation(self):
  actor={'position':[0,0,0],'actions':[{'clip':'turn','start':0,'end':2,'yaw':1.7}]};foot={'ankle':[-.12,0,.1],'phase':.5};self.assertEqual(foot_at(actor,foot,.1)[0],foot_at(actor,foot,.8)[0]);self.assertEqual(foot_heading(actor,foot,.1),foot_heading(actor,foot,.8));foot['phase']=0;self.assertEqual(foot_at(actor,foot,1.2)[0],foot_at(actor,foot,2)[0])
 def test_ly_matches_j_and_digraphs_do_not_cross_words(self):
  self.assertEqual(viseme('ly'),viseme('j'));self.assertNotEqual(viseme('ly'),viseme('l'));r={'language':'hun','audio_sha256':'a'*64,'textMatches':True,'transcript':'g y','words':[{'type':'word','text':'g','start':.1,'end':.2,'characters':[{'text':'g','start':.1,'end':.2}]},{'type':'word','text':'y','start':.21,'end':.3,'characters':[{'text':'y','start':.21,'end':.3}]}]};self.assertFalse(any(c['phone']=='gy' for c in aligned_cues(r,'g y',1,'a'*64)['mouthCues']))
 def test_walk_turn_pelvis_transition_does_not_snap(self):
  actor={'position':[0,0,0],'actions':[{'clip':'walk','start':24,'end':30,'destination':[0,-.8,0]},{'clip':'turn','start':30,'end':31,'yaw':1.2}]}
  self.assertEqual(support_shift(actor,30),support_shift(actor,30-1/24))
  self.assertLess(max(abs(a-b) for a,b in zip(support_shift(actor,30),support_shift(actor,30+1/24))),.005)
 def test_zero_duration_component_is_valid_only_inside_measured_grapheme(self):
  def review(text,chars):return {'language':'hun','audio_sha256':'a'*64,'textMatches':True,'transcript':text,'words':[{'type':'word','text':text,'start':0,'end':.2,'characters':chars}]}
  r=review('ny',[{'text':'n','start':0,'end':0},{'text':'y','start':0,'end':.2}]);track=aligned_cues(r,'ny',1,'a'*64);self.assertEqual(track['mouthCues'][0]['phone'],'ny');self.assertEqual(track['mouthCues'][0]['end'],.2)
  with self.assertRaises(ValueError):aligned_cues(review('a',[{'text':'a','start':0,'end':0}]),'a',1,'a'*64)
 def test_support_fit_keeps_targets_fixed_and_reports_infeasible_pose(self):
  from animation_system.support import fit_support
  import math
  hips=[[0,0,1],[.3,0,1]];targets=[[0,0,0],[.3,0,0]];delta,residual=fit_support(hips,targets,[.9,.9])
  self.assertLess(residual,.00001);self.assertLess(delta[2],-.1)
  for h,t in zip(hips,targets):self.assertLessEqual(math.dist([a+b for a,b in zip(h,delta)],t),.9)
  _,residual=fit_support([[0,0,0],[0,0,0]],[[-2,0,0],[2,0,0]],[.5,.5]);self.assertGreater(residual,1)
if __name__=='__main__':unittest.main()
