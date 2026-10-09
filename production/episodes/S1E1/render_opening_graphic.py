"""15-second motion-graphic opening from a native 3D lookdev frame.

This performs an image move and title fades, not character animation.
Usage: python render_opening_graphic.py SOURCE_PNG FULL_AUDIO OUTPUT_MP4
"""
import sys,subprocess,json
from pathlib import Path
image,audio,output=map(Path,sys.argv[1:]);output.parent.mkdir(parents=True,exist_ok=True)
filters="scale=1920:1080,zoompan=z='1+0.06*on/359':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=360:s=1280x720:fps=24,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.28:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf:text='CSODAKAPU':fontcolor=0xFFE5A0:fontsize=76:x=(w-tw)/2:y=h*0.26:shadowcolor=black@0.6:shadowx=3:shadowy=3:alpha='if(lt(t,2),0,if(lt(t,3),(t-2),if(lt(t,12),1,if(lt(t,13),13-t,0))))',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='WonderlyTales':fontcolor=white:fontsize=30:x=(w-tw)/2:y=h*0.40:alpha='if(lt(t,3),0,if(lt(t,4),t-3,if(lt(t,12),1,if(lt(t,13),13-t,0))))',fade=t=in:st=0:d=0.5,fade=t=out:st=14:d=1"
subprocess.run(['ffmpeg','-y','-v','error','-i',str(image),'-ss','63.708333','-i',str(audio),'-vf',filters,'-t','15','-r','24','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(output)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-of','json',str(output)]))
assert abs(float(probe['format']['duration'])-15)<.1
print('MOTION_GRAPHIC_OPENING_DRAFT',probe['format']['duration'])
