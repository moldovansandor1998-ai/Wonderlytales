"""Independent local recognition of the 20 flagged takes; never grants approval.

Run with faster-whisper==1.2.1. Hungarian is supplied as a language hint only;
the expected script is never supplied to the recognizer. Word timing is evidence,
not a replacement for measured phonemes or a listening/acting review.
"""
import hashlib,json,re,sys,unicodedata,subprocess
import numpy as np
from pathlib import Path
from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

root=Path(__file__).resolve().parents[1]
model_path=snapshot_download('Systran/faster-whisper-medium',
    revision='8701f851d407f3f47e091bb13b8dac5290c7f7fb',
    allow_patterns=['config.json','model.bin','tokenizer.json','vocabulary.json','vocabulary.txt','preprocessor_config.json'])
model=WhisperModel(model_path,device='cpu',compute_type='int8',cpu_threads=4)
source=json.loads((root/'ops/speech-review-required-20261010.json').read_text())
out=root/'ops/independent-speech-review-v024.json'
report={'model':'Systran/faster-whisper-medium','model_revision':'8701f851d407f3f47e091bb13b8dac5290c7f7fb',
    'library':'faster-whisper==1.2.1','language_hint':'hu','script_prompt_used':False,
    'method':'independent recognition, not listening or phonetic adjudication',
    'production_approved':False,'complete':False,'rows':[]}
def normalize(text):return re.sub(r'[^\w]+',' ',unicodedata.normalize('NFC',text).lower()).strip()
for row in source['rows']:
    path=root/'data/speech-audit'/f"{row['id']}.mp3"
    if hashlib.sha256(path.read_bytes()).hexdigest()!=row['audio_sha256']:raise ValueError('Take hash mismatch')
    decoded=subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(path),'-f','f32le','-ac','1','-ar','16000','-'],check=True,capture_output=True).stdout
    samples=np.frombuffer(decoded,dtype='<f4')
    segments,info=model.transcribe(samples,language='hu',beam_size=5,temperature=0,
        condition_on_previous_text=False,word_timestamps=True,vad_filter=False)
    segments=list(segments);text=''.join(s.text for s in segments).strip()
    item={'id':row['id'],'audio_sha256':row['audio_sha256'],'character':row['character'],
          'expected':row['text'],'scribe':row['recognized_text'],'independent_transcript':text,
          'text_matches':normalize(row['text'])==normalize(text),
          'words':[dict(start=w.start,end=w.end,text=w.word,probability=w.probability) for s in segments for w in s.words],
          'duration_sec':info.duration,'auditory_review_complete':False,'usable_for_lipsync':False}
    report['rows'].append(item);out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print('RECOGNIZED',row['id'],text,flush=True)
report['complete']=True;report['matching_transcripts']=sum(a['text_matches'] for a in report['rows'])
out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REVIEW_COMPLETE',report['matching_transcripts'],flush=True)
