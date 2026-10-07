"""Create an RMS jaw-test envelope; usage: python this.py AUDIO.mp3 OUTPUT.json"""
import subprocess,numpy as np,json,hashlib,sys
from pathlib import Path
p=Path(sys.argv[1]).resolve();destination=Path(sys.argv[2]).resolve()
assert p.is_file()
assert hashlib.sha256(p.read_bytes()).hexdigest()=='65e57e36502ecf0d2027b4ddf0af1c0c81bddeffd251aad96f8c927343fe36c9', 'Use the recorded Hallod? line; this test pins its identity and transcript.'
a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ac','1','-ar','24000','-']),dtype=np.float32)
fps=24;n=int(np.ceil(len(a)/1000)); rms=np.array([np.sqrt(np.mean(a[i*1000:min((i+1)*1000,len(a))]**2)) for i in range(n)])
threshold=float(np.quantile(rms,.15)); scale=float(np.quantile(rms,.92)); assert scale>threshold, 'Audio has no measurable speech envelope'
raw=np.clip((rms-threshold)/(scale-threshold),0,1)
# Amplitude-linked mechanical test. No phoneme inference or claimed visemes.
env=np.convolve(np.pad(raw,(1,1)),[.2,.6,.2],mode='valid')
values=[0.]*12+env.tolist()+[0.]*12
out={'status':'DRAFT_AMPLITUDE_JAW_TEST_NOT_PHONEME_LIP_SYNC','dialogue':'Hallod? Ropogós az egész erdő.','audio_path':str(p),'audio_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'audio_duration_sec':len(a)/24000,'audio_offset_sec':.5,'fps':24,'jaw_values':values,'frame_count':len(values),'algorithm':'24 fps RMS, percentile noise floor, 0.2/0.6/0.2 smoothing','phoneme_alignment':False}
destination.write_text(json.dumps(out,indent=2))
print('Envelope',len(values),'frames',len(a)/24000,'seconds audio; max frame',int(np.argmax(values))+1)
