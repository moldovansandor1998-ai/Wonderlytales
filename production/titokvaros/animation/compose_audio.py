"""Original procedural score/foley stems, plus actual recorded HU dialogue.
No downloaded copyrighted music or cloned actor. Procedural sound is labelled
as such; it is not claimed to be a field recording. Dialogue is never fabricated.
"""
import argparse,json,wave,subprocess,math
from pathlib import Path
import numpy as np
SR=48000;DURATION=48;N=SR*DURATION;rng=np.random.default_rng(731)
TIMINGS={x['id']:x['at'] for x in json.loads((Path(__file__).resolve().parents[1]/'episodes/TV_S1E1/demo.json').read_text())['dialogue']}

def write(path,x):
 x=np.clip(x,-.97,.97)
 with wave.open(str(path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((x*32767).astype('<i2').tobytes())

def add(stem,x,at,amp=.1,pan=0):
 offset=round(at*SR);end=min(N,offset+len(x));length=end-offset
 if length<=0:return
 gains=np.array([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)])
 stem[offset:end]+=x[:length,None]*gains*amp

def pluck(freq,dur=1.7,bright=False):
 t=np.arange(round(dur*SR))/SR;y=np.zeros(len(t))
 for k in range(1,7):y+=np.sin(2*np.pi*freq*k*t)*np.exp(-t*(2.8+k*.7))/(k**(1.2 if bright else 1.7))
 return y*(1-np.exp(-t*180))

def modal(freq,dur=.7):
 t=np.arange(round(dur*SR))/SR;y=np.zeros(len(t))
 for ratio,amp in [(1,1),(2.76,.5),(5.4,.25),(8.93,.10)]:y+=amp*np.sin(2*np.pi*freq*ratio*t)*np.exp(-t*(5+ratio))
 return y

def main():
 p=argparse.ArgumentParser();p.add_argument('--out',required=True);p.add_argument('--dialogue');a=p.parse_args();out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
 music=np.zeros((N,2));foley=np.zeros_like(music);city=np.zeros_like(music);dialogue=np.zeros_like(music)
 # Original three-note motif D-A-E, varied against D minor / B-flat / G minor.
 for bar,base in enumerate([146.83,146.83,116.54,130.81,146.83,116.54,98,146.83]):
  at=bar*6
  for beat,ratio in [(0,1),(.75,1.5),(1.5,2.25),(3,1),(4.5,1.5)]:
   if 13<at+beat<16:continue
   add(music,pluck(base*ratio),at+beat,.035,(-.3 if beat<2 else .3))
  t=np.arange(6*SR)/SR;pad=sum(np.sin(2*np.pi*base*r*t) for r in [1,1.1892,1.4983])/3;pad*=np.sin(np.pi*t/6)**2
  add(music,pad,at,.035)
 for t in np.arange(18,34,.5):add(music,modal(72,.25),float(t),.04)
 wind=rng.standard_normal(N);wind=np.convolve(wind,np.ones(64)/64,mode='same');city[:,0]=wind*.025;city[:,1]=np.roll(wind,1200)*.025
 for at in [2,7,10,43]:add(city,modal(420,1.2),at,.018,-.6)
 for start,end,stride in [(0,5,.43),(18,24,.23)]:
  for i,t in enumerate(np.arange(start,end,stride)):
   noise=rng.standard_normal(5000)*np.exp(-np.arange(5000)/(SR*.028));add(foley,noise,float(t),.09,(-.5 if i%2 else .2))
 add(foley,modal(750,.35),13.15,.15);add(foley,modal(260,.7),14.7,.2,.35);add(foley,modal(390,.7),15.1,.15,.35)
 roll=rng.standard_normal(9*SR);roll=np.convolve(roll,np.ones(9)/9,mode='same');roll*=np.linspace(.15,.45,len(roll));add(foley,roll,15,.13,.3)
 for at in np.arange(15.3,24,.28):add(foley,modal(170,.18),float(at),.04,.3)
 add(foley,modal(330,1.2),33.7,.3,.3);add(foley,modal(110,2.5),34.0,.12)
 audit={'duration_sec':48,'sample_rate':SR,'source':'original procedural composition and modal/noise synthesis','dialogue':[],'production_approved':False,'listening_review':'PENDING'}
 if a.dialogue:
  for j in sorted(Path(a.dialogue).glob('TV_D001_L*.json')):
   d=json.loads(j.read_text());mp3=j.with_suffix('.mp3')
   if d.get('status')!='RECORDED_PENDING_REVIEW' or not mp3.exists():continue
   raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(mp3),'-f','f32le','-ac','1','-ar',str(SR),'-']);samples=np.frombuffer(raw,dtype='<f4')
   at=TIMINGS[d['id']];add(dialogue,samples,float(at),1.05);audit['dialogue'].append({'id':d['id'],'actual_audio_duration_sec':len(samples)/SR,'at':at})
 for name,stem in [('score_original',music),('foley_original',foley),('city_ambience',city),('dialogue_hu',dialogue)]:write(out/(name+'.wav'),stem)
 mix=music+foley+city+dialogue;peak=np.max(np.abs(mix));mix*=min(1,.89/max(peak,.001));write(out/'TV_sound_mix_V001.wav',mix)
 audit['mix_peak_dbfs']=20*math.log10(max(np.max(np.abs(mix)),1e-9));(out/'audio_audit.json').write_text(json.dumps(audit,indent=2));print(json.dumps(audit))
if __name__=='__main__':main()
