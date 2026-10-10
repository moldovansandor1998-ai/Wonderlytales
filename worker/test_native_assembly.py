import hashlib,sys,tempfile,unittest,subprocess,shutil,wave
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from native_assembly import assemble_native
class AssemblyTest(unittest.TestCase):
 def test_real_concat_checks_clips_and_full_hungarian_mix(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);objects={};clips=[]
   for i,color in enumerate(['black','white']):
    p=root/f'{i}.mp4'
    subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'color={color}:s=128x72:r=24','-frames:v','12','-c:v','libx264','-pix_fmt','yuv420p',str(p)],check=True)
    key=f'renders/native/S1E1/test/{i}.mp4';objects[key]=p;clips.append(dict(key=key,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),frames=12))
   audio=root/'mix.wav'
   with wave.open(str(audio),'wb') as out:out.setnchannels(2);out.setsampwidth(2);out.setframerate(48000);out.writeframes(b'\0'*48000*4)
   objects['audio/S1E1/test/mix.wav']=audio
   class Store:
    def download_file(self,bucket,key,path):shutil.copyfile(objects[key],path)
    def upload_file(self,path,bucket,key,ExtraArgs=None):shutil.copyfile(path,root/'result.mp4')
   payload=dict(clips=clips,frames=24,audio_key='audio/S1E1/test/mix.wav',audio_sha256=hashlib.sha256(audio.read_bytes()).hexdigest())
   result=assemble_native(Store(),'b',payload)
   self.assertEqual(result['frames'],24);self.assertTrue(result['decoded']);self.assertFalse(result['production_approved'])
   raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(root/'result.mp4'),'-vf','scale=1:1','-f','rawvideo','-pix_fmt','gray','-'])
   self.assertEqual(len(raw),24);self.assertLess(raw[0],20);self.assertGreater(raw[23],230)
   payload['audio_sha256']='a'*64
   with self.assertRaises(RuntimeError):assemble_native(Store(),'b',payload)
if __name__=='__main__':unittest.main()
