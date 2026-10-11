import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {join} from 'node:path';
import {writeFile,readFile} from 'node:fs/promises';
import {R2VideoStore,digest} from './storage';
import {tempMedia,storeFile,speechTrack,concatenate} from './post-media';
import {CUT_LEAD,speechDuration,type CutShot} from './film-cut-shared';
import {WaveSpeedError} from '../providers/wavespeed';
const exec=promisify(execFile),ffmpeg=join(process.cwd(),'node_modules/ffmpeg-static/ffmpeg');
const fit='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1';
export async function miraDuplicateMask(store:R2VideoStore){
 return tempMedia(async dir=>{
  // Measured against the reviewed 1920x1080 entrance clip. The real Mira walks
  // on the left; only the stationary duplicate on the far right is masked.
  const out=join(dir,'mask.png');
  await run(['-f','lavfi','-i','color=c=black:s=1920x1080','-vf','drawbox=x=1440:y=250:w=480:h=830:color=white:t=fill','-frames:v','1',out]);
  const bytes=await readFile(out),sha=digest(bytes);await store.putChunk(sha,0,bytes);await store.completeImage(sha,bytes.length);return sha;
 });
}
async function run(args:string[]){try{return await exec(ffmpeg,['-nostdin','-hide_banner','-y',...args],{timeout:90000,maxBuffer:1024*1024});}catch{throw new WaveSpeedError('CUT_MEDIA_FAILED');}}
export async function mediaInfo(path:string){
 const r=await run(['-i',path,'-t','0','-f','null','-']);
 const m=/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(r.stderr);
 if(!m)throw new WaveSpeedError('CUT_MEDIA_DURATION_UNKNOWN');
 return {duration:Number(m[1])*3600+Number(m[2])*60+Number(m[3]),audio:/Audio:/.test(r.stderr)};
}
export async function cutSpeech(store:R2VideoStore,s:CutShot){
 if(!s.line||!s.recording)throw new WaveSpeedError('CUT_AUDIO_MISSING');
 return tempMedia(async dir=>{
  const file=join(dir,'voice.mp3');await writeFile(file,await store.dialogueAudio(s.recording!));
  const info=await mediaInfo(file),minimum=speechDuration(info.duration,s.maxSeconds);
  const seconds=s.kind==='action'?s.seconds:minimum;
  if(seconds<minimum)throw new WaveSpeedError('CUT_SPEECH_TOO_LONG',409);
  const audio=await storeFile(store,await speechTrack(dir,store,[{...s.line!,offset:CUT_LEAD}],{'0':s.recording!},seconds,0),'wav');
  return {seconds,audio};
 });
}
export async function finishCutShot(store:R2VideoStore,s:CutShot){
 return tempMedia(async dir=>{
  const file=join(dir,'source.mp4'),out=join(dir,'finished.mp4');
  await writeFile(file,await store.assetBytes(s.cleaned??s.raw??s.source!,'mp4'));
  const info=await mediaInfo(file),start=s.kind==='reuse'?(s.start??0):0;
  const seconds=s.kind==='reuse'?Math.min(s.end??info.duration,info.duration)-start:s.seconds;
  if(seconds<=0||info.duration+1/24<start+seconds)throw new WaveSpeedError('CUT_VIDEO_TOO_SHORT');
  const args=['-i',file],replacement=s.kind!=='reuse'&&s.audio;
  let useExtraAudio=false;
  if(replacement){const wav=join(dir,'voice.wav');await writeFile(wav,await store.assetBytes(s.audio!,'wav'));args.push('-i',wav);}
  else if(s.cleaned&&s.raw){
   // Text cleanup is a visual operation. Retain the original action sound even
   // when the cleanup provider omits or changes its output audio track.
   const original=join(dir,'original.mp4');await writeFile(original,await store.assetBytes(s.raw,'mp4'));
   if((await mediaInfo(original)).audio)args.push('-i',original);
   else args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
   useExtraAudio=true;
  }
  else if(!info.audio)args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');
  const audio=replacement||useExtraAudio||!info.audio?'1:a:0':'0:a:0';
  const framing=s.cropPreset?`crop=1280:720:${{left:0,center:320,right:640}[s.cropPreset]}:0,`+fit:s.framingRepair==='felix-bag'?'crop=1600:900:0:0,'+fit:s.framingRepair==='felix-phone'?'crop=1408:792:128:120,'+fit:fit;
  // Keep words intact: shot length comes from the complete decoded MP3 + handles.
  // Original generated voices are replaced with the exact assigned character recording.
  await run([...args,'-ss',String(start),'-t',String(seconds),'-map','0:v:0','-map',audio,'-vf',framing,'-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r','24','-af',`aresample=48000,aformat=channel_layouts=stereo,apad,atrim=0:${seconds},afade=t=in:d=0.015,afade=t=out:st=${Math.max(0,seconds-.035)}:d=0.035,alimiter=limit=0.95:level=false`,'-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',out]);
  const result=await mediaInfo(out);if(!result.audio||Math.abs(result.duration-seconds)>.1)throw new WaveSpeedError('CUT_MEDIA_DURATION_MISMATCH');
  return {asset:await storeFile(store,out,'mp4'),seconds};
 });
}
export async function assembleCut(store:R2VideoStore,shots:CutShot[]){
 if(!shots.length||shots.some(s=>s.phase!=='READY'||!s.asset))throw new WaveSpeedError('CUT_INCOMPLETE',409);
 return tempMedia(async dir=>{
  const files:string[]=[];
  // Bounded to this 0–15 preview; download sequentially to keep server memory bounded.
  for(const [i,s] of shots.entries()){const file=join(dir,`shot-${i}.mp4`);await writeFile(file,await store.assetBytes(s.asset!,'mp4'));files.push(file);}
  const out=join(dir,'film.mp4'),duration=shots.reduce((n,s)=>n+s.seconds,0);
  await concatenate(files,out,shots.map(s=>s.seconds));
  const info=await mediaInfo(out);if(!info.audio||Math.abs(info.duration-duration)>.15)throw new WaveSpeedError('CUT_ASSEMBLY_DURATION_MISMATCH');
  return {master:await storeFile(store,out,'mp4'),duration};
 });
}
