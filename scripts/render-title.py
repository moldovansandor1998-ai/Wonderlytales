"""Reproducible 10-second WonderlyTales intro edit; title layers incur no AI fee."""
from pathlib import Path
import argparse, json, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT=Path('/workspace/scratch/77d35433dfb7/felix-ai')
W,H=1920,1080
SERIF='/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
SANS='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def blank(): return Image.new('RGBA',(W,H))

def mask_text(text,size,cx,y,maxwidth=None,stretch=1,spacing=0,font=SERIF):
    f=ImageFont.truetype(font,size); widths=[f.getlength(c) for c in text]
    width=int(sum(widths)+max(0,len(text)-1)*spacing)+12
    m=Image.new('L',(width,size*2)); d=ImageDraw.Draw(m); x=6
    box=f.getbbox(text); top=box[1]
    for char,cw in zip(text,widths):
        d.text((x,-top+4),char,font=f,fill=255); x+=cw+spacing
    b=m.getbbox();m=m.crop(b)
    nw=m.width if not maxwidth else min(m.width,maxwidth)
    m=m.resize((nw,int(m.height*stretch)),Image.Resampling.LANCZOS)
    full=Image.new('L',(W,H));full.paste(m,(int(cx-nw/2),y));return full

def gold(mask,depth=6):
    out=blank(); shadow=ImageChops.offset(mask,7,depth+9).filter(ImageFilter.GaussianBlur(9))
    out.paste((10,23,35,200),(0,0),shadow)
    edge=mask.filter(ImageFilter.MaxFilter(5))
    for i in range(depth,0,-1):out.paste((111+int(40*(depth-i)/max(depth,1)),63,17,255),(0,0),ImageChops.offset(edge,i,i))
    out.paste((255,233,166,255),(0,0),edge)
    ys=np.indices((H,W))[0]; b=mask.getbbox(); pos=np.clip((ys-b[1])/max(1,b[3]-b[1]),0,1)
    stops=np.array([0,.22,.48,.55,.8,1]);colors=np.array([[255,251,214],[255,222,135],[245,186,75],[255,238,172],[221,142,35],[255,218,119]])
    arr=np.zeros((H,W,4),dtype=np.uint8)
    for c in range(3):arr[:,:,c]=np.interp(pos,stops,colors[:,c])
    arr[:,:,3]=np.array(mask);out.alpha_composite(Image.fromarray(arr))
    return out

def overlays(episode,title):
    cx=608
    brand=gold(mask_text('WONDERLYTALES',38,cx,170,spacing=8,font='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'),1)
    d=ImageDraw.Draw(brand)
    d.arc((325,98,890,240),196,344,fill=(255,221,139,230),width=2)
    d.polygon([(608,81),(613,107),(638,111),(614,117),(608,143),(602,117),(578,111),(602,107)],fill=(255,234,168,255))
    brand.save(ROOT/'title-brand.png')
    main=gold(mask_text('TITOKVÁROS',160,cx,273,maxwidth=1030,stretch=1.18,font='/usr/share/fonts/opentype/urw-base35/P052-Bold.otf'),8)
    d=ImageDraw.Draw(main);d.line((207,493,493,493),fill=(247,201,107,230),width=3);d.line((720,493,1008,493),fill=(247,201,107,230),width=3)
    # A restrained paw mark beneath the title.
    d.ellipse((590,490,626,513),fill=(255,220,128,255))
    for x,y in [(581,475),(594,467),(611,467),(624,475)]:d.ellipse((x,y,x+10,y+14),fill=(255,231,159,255))
    main.save(ROOT/'title-main.png')
    ep=gold(mask_text(f'{episode}. RÉSZ',30,cx,548,spacing=5),1)
    ep.alpha_composite(gold(mask_text(title.upper(),48,cx,602,maxwidth=990,spacing=1),2))
    ep.save(ROOT/'title-episode.png')

def run(args):subprocess.run(args,check=True)

def render(episode,title):
    # First 8 seconds of the city movement become 5 seconds; talking performance follows its own first frame.
    filters=';'.join([
        '[0:v]trim=start=0:end=8,setpts=(PTS-STARTPTS)*0.625,scale=1920:1080:flags=lanczos,setsar=1,fps=24,trim=duration=5[v0]',
        # Avatar service center-cropped a 1312x739 resize to 1312x704, y=17.
        # Restore that framing using the original image's narrow top/bottom strips.
        '[1:v]setpts=PTS-STARTPTS,scale=1920:1029:flags=lanczos,format=rgba,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=1,trim=duration=5[v1crop]',
        '[6:v]scale=1920:1080:flags=lanczos,format=rgba,setsar=1,trim=duration=5,setpts=PTS-STARTPTS[reference]',
        '[reference][v1crop]overlay=x=0:y=25:format=auto:shortest=1,format=yuv420p[v1]',
        '[v0][v1]concat=n=2:v=1:a=0[base]',
        '[2:v]format=rgba,fade=t=in:st=0.25:d=0.7:alpha=1[brand]',
        '[3:v]format=rgba,fade=t=in:st=1.65:d=0.85:alpha=1[title]',
        '[4:v]format=rgba,fade=t=in:st=7.35:d=0.6:alpha=1[ep]',
        '[base][brand]overlay=0:0:shortest=1[b]',
        "[b][title]overlay=x=0:y='if(lt(t,2.5),16*max(0,(2.5-t)/0.85),0)':shortest=1[c]",
        '[c][ep]overlay=0:0:shortest=1,format=yuv420p[v]',
        "[0:a]atrim=duration=10,asetpts=PTS-STARTPTS,aresample=48000,loudnorm=I=-22:TP=-3:LRA=9,volume='if(between(t,5.5,7.7),0.23,0.85)':eval=frame,afade=t=in:st=0:d=0.12,afade=t=out:st=9.6:d=0.4[music]",
        '[5:a]aresample=48000,adelay=5000:all=1,apad=whole_dur=10,atrim=duration=10[voice]',
        '[music][voice]amix=inputs=2:duration=first:normalize=0,volume=1.4,alimiter=limit=0.89:level=false,aresample=48000[a]'
    ])
    (ROOT/'title-edit.ffscript').write_text(filters)
    args=['ffmpeg','-hide_banner','-loglevel','warning','-y','-i',str(ROOT/'Titokvaros_focim_mozgas_nyers.mp4'),'-i',str(ROOT/'title-dialogue.mp4')]
    for f in ['title-brand.png','title-main.png','title-episode.png']:args+=['-loop','1','-framerate','24','-i',str(ROOT/f)]
    args+=['-i',str(ROOT/'title-dialogue-timed.wav'),'-loop','1','-framerate','24','-i',str(ROOT/'title-dialogue-start.png'),'-filter_complex_threads','2','-filter_complex_script',str(ROOT/'title-edit.ffscript'),'-map','[v]','-map','[a]','-t','10','-r','24','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-ar','48000','-ac','2','-movflags','+faststart','-metadata',f'title=WonderlyTales – Titokváros | {episode}. rész – {title}','-metadata','comment=AI-generated animation, ElevenLabs character voice, editorial title composite',str(ROOT/'WonderlyTales_Titokvaros_Focim_1080p.mp4')]
    run(args)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--episode',type=int,default=1);p.add_argument('--title',default='A rossz kanyar');p.add_argument('--overlays-only',action='store_true');a=p.parse_args()
    overlays(a.episode,a.title)
    if not a.overlays_only:render(a.episode,a.title)
