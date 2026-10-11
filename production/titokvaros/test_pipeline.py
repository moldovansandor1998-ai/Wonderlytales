import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('pipeline',Path(__file__).with_name('pipeline.py'));p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class PipelineTests(unittest.TestCase):
 def manifest(self,n=500):return {'series':'TITOKVAROS','fps':24,'duration_frames':n*144,'shots':[{'id':f'TV_SH{i:04}','start':i*144+1,'end':(i+1)*144,'revision':1} for i in range(n)]}
 def test_500_scene_resume_and_local_invalidation(self):
  db=p.database(':memory:');m=self.manifest();ids=p.plan(db,m,'a'*64);p.claim(db,ids[0]);p.submitted(db,ids[0],'job-1');p.complete(db,ids[0],'renders/native/S1E1/test/clip.mp4','b'*64,144)
  self.assertEqual(ids,p.plan(db,m,'a'*64));self.assertEqual(db.execute('select state from tasks where identity=?',(ids[0],)).fetchone()[0],'RENDERED_PENDING_QC')
  m['shots'][17]['revision']=2;new=p.plan(db,m,'a'*64);self.assertEqual(len(set(new)-set(ids)),1);self.assertEqual(db.execute('select count(*) from tasks').fetchone()[0],501)
 def test_uncertain_submit_is_not_repeated(self):
  db=p.database(':memory:');key=p.plan(db,self.manifest(1),'a'*64)[0];p.claim(db,key)
  with self.assertRaises(ValueError):p.claim(db,key)
 def test_gap_and_wrong_frame_count_rejected(self):
  m=self.manifest(2);m['shots'][1]['start']+=1
  with self.assertRaises(ValueError):p.validate(m)
  db=p.database(':memory:');key=p.plan(db,self.manifest(1),'a'*64)[0];p.claim(db,key);p.submitted(db,key,'job-2')
  with self.assertRaises(ValueError):p.complete(db,key,'renders/native/S1E1/test/clip.mp4','c'*64,143)
 def test_source_change_invalidates_all_dependent_tasks(self):
  db=p.database(':memory:');m=self.manifest(3);a=p.plan(db,m,'a'*64);b=p.plan(db,m,'b'*64);self.assertFalse(set(a)&set(b))
 def test_independent_sources_only_invalidate_changed_shot(self):
  db=p.database(':memory:');m=self.manifest()
  for s in m['shots']:s['source_sha256']='a'*64
  old=p.plan(db,m,'b'*64);m['shots'][237]['source_sha256']='c'*64;new=p.plan(db,m,'b'*64)
  self.assertEqual(len(set(new)-set(old)),1);self.assertEqual(len(set(old)&set(new)),499)
if __name__=='__main__':unittest.main()
