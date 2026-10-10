"""Hungarian visemes from cached, audio-aligned character timestamps.

No synthetic text-length timing. Source recording hash and matching transcript
are mandatory. Grapheme-to-phoneme grouping handles Hungarian digraphs. This is
audio-aligned orthographic timing, not a claim of manually approved phonetics.
"""
import re, subprocess, json, math
from pathlib import Path
from .spec import digest, atomic_json, VISEMES, smooth

DIGRAPHS=('dzs','dz','cs','gy','ly','ny','sz','ty','zs')
def validate_track(track):
 if track.get('method') not in ('MATCHED_AUDIO_CHARACTER_ALIGNMENT_HU_DIGRAPHS','CACHED_RHUBARB_V020_DEVELOPMENT'):raise ValueError('Unsupported speech alignment')
 duration=float(track['duration'])
 if not math.isfinite(duration) or duration<=0:raise ValueError('Invalid recording duration')
 cursor=0.
 for cue in track['mouthCues']:
  a,b=float(cue['start']),float(cue['end'])
  if not math.isfinite(a+b) or a<cursor-1e-6 or b<=a or b>duration+.001 or cue['value'] not in VISEMES:raise ValueError('Invalid or overlapping mouth cue')
  cursor=b
 if not track['mouthCues']:raise ValueError('Missing mouth cues')
 if track['method']=='CACHED_RHUBARB_V020_DEVELOPMENT' and track.get('phoneme_boundaries_verified') is not False:raise ValueError('Cached trial cannot claim verified phonetics')
 return track

def import_cached_rhubarb(audio,cues_path,expected_cues_sha,expected_audio_sha):
 audio,cues_path=Path(audio),Path(cues_path)
 if digest(cues_path)!=expected_cues_sha:raise ValueError('Cached mouth cues changed')
 if digest(audio)!=expected_audio_sha:raise ValueError('Cached recording changed')
 cached=json.loads(cues_path.read_text())
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]))
 if abs(duration-float(cached['metadata']['duration']))>.02:raise ValueError('Cached cues do not match recording length')
 return validate_track({'schema':'WONDERLY_HU_VISEMES_V1','method':'CACHED_RHUBARB_V020_DEVELOPMENT','duration':duration,'audio_sha256':digest(audio),'source_cues_sha256':expected_cues_sha,'language':'hu','artist_verified':False,'phoneme_boundaries_verified':False,'mouthCues':cached['mouthCues']})
def normalize(text):return ''.join(c for c in text.casefold() if c.isalnum())
def viseme(phone):
 if phone in ('m','b','p'):return 'A'
 if phone in ('f','v'):return 'G'
 if phone=='l':return 'H'
 if phone in 'aá':return 'D'
 if phone in 'eé':return 'C'
 if phone in 'ií':return 'B'
 if phone in 'oóöő':return 'E'
 if phone in 'uúüű':return 'F'
 return 'B'

def aligned_cues(review,expected,duration,source_sha):
 if not review.get('textMatches') or normalize(review['transcript'])!=normalize(expected):raise ValueError('Hungarian transcript is not verified against the script')
 characters=[dict(c,word_index=wi) for wi,w in enumerate(review.get('words',[])) if w.get('type')=='word' for c in w.get('characters',[]) if c.get('text','').isalpha()]
 if not characters:raise ValueError('No measured character timing')
 cues=[];i=0
 while i<len(characters):
  combined=None
  for phone in DIGRAPHS:
   if ''.join(c['text'].casefold() for c in characters[i:i+len(phone)])==phone and len({c['word_index'] for c in characters[i:i+len(phone)]})==1 and all(characters[k+1]['start']-characters[k]['end']<.08 for k in range(i,min(i+len(phone)-1,len(characters)-1))):combined=phone;break
  n=len(combined) if combined else 1;phone=combined or characters[i]['text'].casefold();a=float(characters[i]['start']);b=float(characters[i+n-1]['end']);i+=n
  if not 0<=a<=b<=duration+.08:raise ValueError('Audio timing exceeds recording')
  if b<=a:continue
  a=max(0,a-.025);b=min(duration,b-.010)
  if cues and a<cues[-1]['end']:a=cues[-1]['end']
  if b>a:cues.append({'start':a,'end':b,'value':viseme(phone),'phone':phone})
 result=[];cursor=0.
 for cue in cues:
  if cue['start']>cursor:result.append({'start':cursor,'end':cue['start'],'value':'X','phone':'sil'})
  if result and result[-1]['value']==cue['value'] and abs(result[-1]['end']-cue['start'])<1e-6:result[-1]['end']=cue['end'];result[-1]['phone']+=' '+cue['phone']
  else:result.append(cue)
  cursor=cue['end']
 if cursor<duration:result.append({'start':cursor,'end':duration,'value':'X','phone':'sil'})
 return {'schema':'WONDERLY_HU_VISEMES_V1','audio_sha256':source_sha,'duration':duration,'language':'hu','method':'MATCHED_AUDIO_CHARACTER_ALIGNMENT_HU_DIGRAPHS','transcript_matches':True,'artist_verified':False,'phoneme_boundaries_verified':False,'mouthCues':result}

def weights_at(track,t,blend=.035):
 cues=track['mouthCues'];weights={v:0. for v in VISEMES}
 if t<0 or t>=track['duration']:weights['X']=1.;return weights
 for i,c in enumerate(cues):
  if c['start']<=t<c['end']:
   previous=cues[i-1]['value'] if i else 'X';u=smooth((t-c['start'])/min(blend,max(.001,(c['end']-c['start'])*.5)))
   weights[previous]+=1-u;weights[c['value']]+=u;return weights
 weights['X']=1.;return weights

def build_recording(source,output,review,text):
 source,output=Path(source),Path(output);output.parent.mkdir(parents=True,exist_ok=True)
 if review.get('audio_sha256')!=digest(source):raise ValueError('Alignment belongs to another recording')
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(source)]))
 track=aligned_cues(review,text,duration,digest(source));atomic_json(output,track);return track
