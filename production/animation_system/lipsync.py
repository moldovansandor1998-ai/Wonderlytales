"""Hungarian visemes from cached, audio-aligned character timestamps.

No synthetic text-length timing. Source recording hash and matching transcript
are mandatory. Grapheme-to-phoneme grouping handles Hungarian digraphs. This is
audio-aligned orthographic timing, not a claim of manually approved phonetics.
"""
import re, subprocess, json, math, unicodedata
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
def normalize(text):return re.sub(r'[^\w]+',' ',unicodedata.normalize('NFC',text).casefold()).strip()
def letters(text):return ''.join(c for c in unicodedata.normalize('NFC',text).casefold() if c.isalnum())
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
 if not math.isfinite(duration) or duration<=0:raise ValueError('Invalid recording duration')
 if review.get('language') not in ('hu','hun'):raise ValueError('Hungarian language review required')
 if not review.get('textMatches') or normalize(review['transcript'])!=normalize(expected):raise ValueError('Hungarian transcript is not verified against the script')
 if not re.fullmatch('[a-f0-9]{64}',source_sha) or review.get('audio_sha256')!=source_sha:raise ValueError('Alignment belongs to another recording')
 words=[w for w in review.get('words',[]) if w.get('type')=='word']
 if not words or normalize(' '.join(w.get('text','') for w in words))!=normalize(expected):raise ValueError('Timed words do not match the script')
 characters=[];last_end=0.
 for wi,w in enumerate(words):
  cs=w.get('characters',[])
  if not cs or letters(''.join(c.get('text','') for c in cs))!=letters(w['text']):raise ValueError('Incomplete measured character timing')
  wa,wb=w.get('start'),w.get('end')
  if any(type(v) not in (int,float) or not math.isfinite(v) for v in (wa,wb)) or not 0<=wa<=wb<=duration+.001:raise ValueError('Invalid word timing')
  for c in cs:
   text=unicodedata.normalize('NFC',c.get('text',''));a,b=c.get('start'),c.get('end')
   if len(text)!=1 or any(type(v) not in (int,float) or not math.isfinite(v) for v in (a,b)):raise ValueError('Invalid character timing')
   if a<last_end-1e-6 or a<wa-.001 or b>wb+.001 or b<a:raise ValueError('Overlapping or out-of-range character timing')
   last_end=b
   if text.isdigit():raise ValueError('Numerals require a reviewed spoken transcript')
   if text.isalpha():
    if b<=a:raise ValueError('Zero-duration spoken character')
    characters.append(dict(text=text.casefold(),start=a,end=b,word_index=wi))
 if not characters:raise ValueError('No measured character timing')
 cues=[];i=0
 # Hungarian doubled multigraphs: ssz = sz+sz, ggy = gy+gy, ddzs = dzs+dzs.
 phones=tuple((p[0]+p,p) for p in DIGRAPHS)+tuple((p,p) for p in DIGRAPHS)
 while i<len(characters):
  n=1;phone=characters[i]['text']
  for spelling,base in sorted(phones,key=lambda pair:len(pair[0]),reverse=True):
   group=characters[i:i+len(spelling)]
   if ''.join(c['text'] for c in group)==spelling and len({c['word_index'] for c in group})==1 and all(y['start']-x['end']<.08 for x,y in zip(group,group[1:])):
    n=len(spelling);phone=base;break
  a=characters[i]['start'];b=characters[i+n-1]['end'];wi=characters[i]['word_index'];i+=n
  # Preserve measured onsets, bridge only tiny gaps inside the SAME word.
  if cues and cues[-1]['word_index']==wi and 0<=a-cues[-1]['end']<=.06:cues[-1]['end']=a
  cues.append({'start':a,'end':b,'value':viseme(phone),'phone':phone,'word_index':wi})
 result=[];cursor=0.
 for cue in cues:
  if cue['start']>cursor:result.append({'start':cursor,'end':cue['start'],'value':'X','phone':'sil'})
  cue={k:v for k,v in cue.items() if k!='word_index'}
  if result and result[-1]['value']==cue['value'] and abs(result[-1]['end']-cue['start'])<1e-6:result[-1]['end']=cue['end'];result[-1]['phone']+=' '+cue['phone']
  else:result.append(cue)
  cursor=cue['end']
 if cursor<duration:result.append({'start':cursor,'end':duration,'value':'X','phone':'sil'})
 return validate_track({'schema':'WONDERLY_HU_VISEMES_V1','audio_sha256':source_sha,'duration':duration,'language':'hu','method':'MATCHED_AUDIO_CHARACTER_ALIGNMENT_HU_DIGRAPHS','alignment_revision':2,'expected_text':expected,'transcript_matches':True,'artist_verified':False,'phoneme_boundaries_verified':False,'mouthCues':result})

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
