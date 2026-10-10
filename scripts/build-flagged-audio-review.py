"""Create a listening reel from unchanged flagged recordings and audit evidence."""
from pathlib import Path
import json,subprocess,hashlib,math,textwrap
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];out=root/'data/V024/audio-review';out.mkdir(parents=True,exist_ok=True)
review=json.loads((root/'ops/independent-speech-review-v024.json').read_text());assert review['complete']
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
fonts={n:ImageFont.truetype(font_path,n) for n in [18,24,28,34,42]}
records=[];cursor=0;fps=24
names={'CHAR_MARK':'Márk','CHAR_LILI':'Lili','CHAR_MORZSI':'Morzsi','CHAR_POTTY':'Pötty','CHAR_ZIZI':'Zizi'}
for index,row in enumerate(review['rows'],1):
    audio=root/'data/speech-audit'/f"{row['id']}.mp3";assert hashlib.sha256(audio.read_bytes()).hexdigest()==row['audio_sha256']
    duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(audio)]))
    frames=math.ceil((duration+1.8)*fps);seconds=frames/fps
    im=Image.new('RGB',(1280,720),'#101b2c');draw=ImageDraw.Draw(im)
    draw.text((60,40),'WONDERLYTALES / HANGELLENŐRZÉS',font=fonts[24],fill='#70dccc')
    draw.text((60,92),f'{index:02d} / 20   {names[row["character"]]}',font=fonts[42],fill='white')
    draw.text((60,162),'FORGATÓKÖNYV',font=fonts[18],fill='#91a3bc');y=195
    for line in textwrap.wrap(row['expected'],width=62):draw.text((60,y),line,font=fonts[34],fill='white');y+=45
    y=365
    for label,key in [('Scribe','scribe'),('Független felismerés','independent_transcript')]:
        draw.text((60,y),label,font=fonts[18],fill='#91a3bc');y+=29
        for line in textwrap.wrap(row[key],width=88):draw.text((60,y),line,font=fonts[24],fill='#ebc68b');y+=31
        y+=18
    draw.text((60,638),'Eredeti karakterhang • nincs újragenerálás • kiejtés és alakítás ellenőrzendő',font=fonts[18],fill='#aebbd0')
    draw.text((60,674),row['id']+'  /  SHA256 '+row['audio_sha256'][:16],font=fonts[18],fill='#70819b')
    png=out/f'{index:02d}.png';clip=out/f'{index:02d}.mp4';im.save(png)
    subprocess.run(['ffmpeg','-v','error','-y','-loop','1','-framerate',str(fps),'-i',str(png),'-i',str(audio),
        '-filter_complex','[1:a]adelay=450|450,apad[a]','-map','0:v','-map','[a]','-t',str(seconds),
        '-c:v','libx264','-preset','fast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',str(clip)],check=True)
    records.append({'id':row['id'],'start_sec':cursor,'audio_start_sec':cursor+.45,'duration_sec':seconds,'original_audio_sha256':row['audio_sha256']});cursor+=seconds
(out/'concat.txt').write_text(''.join(f"file '{i:02d}.mp4'\n" for i in range(1,21)))
video=out/'WonderlyTales_20_hang_ellenorzes_V024.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(out/'concat.txt'),'-c','copy','-movflags','+faststart',str(video)],check=True)
subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(video),'-f','null','-'],check=True)
manifest={'kind':'listening_review_not_animation','duration_sec':cursor,'frames':round(cursor*fps),'fps':fps,'source_voices_changed':False,'new_tts':0,'video_sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'records':records}
(root/'ops/audio-review-reel-v024.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print('REEL_COMPLETE',cursor,video,flush=True)
