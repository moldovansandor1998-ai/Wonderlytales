import hashlib,io,sys,unittest
from pathlib import Path
from tempfile import TemporaryDirectory
sys.path.insert(0,str(Path(__file__).parent))
from native_checkpoints import restore_frames,save_frame,render_identity

PNG=b'\x89PNG\r\n\x1a\nfixtureIEND\xaeB`\x82'
class Missing(Exception):
 response={'Error':{'Code':'NoSuchKey'}}
class Store:
 def __init__(self):self.objects={}
 def put_object(self,**kw):self.objects[kw['Key']]={'Body':kw['Body'],'Metadata':kw['Metadata']}
 def get_object(self,**kw):
  if kw['Key'] not in self.objects:raise Missing()
  o=self.objects[kw['Key']];return dict(Body=io.BytesIO(o['Body']),Metadata=o['Metadata'])
class CheckpointTests(unittest.TestCase):
 def test_resume_fresh_container_reuses_only_hash_verified_frames(self):
  s=Store()
  with TemporaryDirectory() as tmp:
   p=Path(tmp)/'frame_000001.png';p.write_bytes(PNG);save_frame(s,'b','render',p)
  with TemporaryDirectory() as tmp:
   self.assertEqual(restore_frames(s,'b','render',tmp,1,3),[1]);self.assertEqual((Path(tmp)/'frame_000001.png').read_bytes(),PNG)
  s.objects['render/frame_000001.png']['Body']=b'corrupt'
  with TemporaryDirectory() as tmp:self.assertEqual(restore_frames(s,'b','render',tmp,1,1),[])
 def test_identity_is_independent_of_local_paths_but_includes_renderer(self):
  j=dict(operation='RENDER_NATIVE_FRAMES',scene_key='native/S1E1/a.blend',scene_sha256='a'*64,frame_start=1,frame_end=360,width=1920,height=1080,samples=128,renderer_revision='a'*40)
  self.assertEqual(render_identity(j),render_identity(dict(j,output='/tmp/a',restored_frames=[1])))
  self.assertNotEqual(render_identity(j),render_identity(dict(j,renderer_revision='b'*40)))
 def test_incomplete_frame_cannot_be_checkpointed(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp)/'frame_000001.png';p.write_bytes(b'bad')
   with self.assertRaises(RuntimeError):save_frame(Store(),'b','render',p)
if __name__=='__main__':unittest.main()
