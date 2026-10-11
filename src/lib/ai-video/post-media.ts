import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const ffmpeg=join(process.cwd(),'node_modules','ffmpeg-static','ffmpeg');
import {R2VideoStore,digest} from './storage';
import type {SceneLine} from './episode-shared';
import type {MixSettings} from './post-shared';
import {WaveSpeedError} from '../providers/wavespeed';
const exec=promisify(execFile);
const encode=['-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r','24'];
const fit='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1';
async function run(args:string[]){if(!ffmpeg)throw new WaveSpeedError('MIX_RUNTIME_MISSING',503);try{return await exec(ffmpeg,['-nostdin','-hide_banner','-y',...args],{timeout:90000,maxBuffer:1024*1024});}catch{throw new WaveSpeedError('MIX_FAILED',502);}}
export async function tempMedia<T>(fn:(dir:string)=>Promise<T>){const dir=await mkdtemp(join(tmpdir(),'wonderly-post-'));try{return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
export async function storeFile(store:R2VideoStore,file:string,ext:'wav'|'mp4'){const bytes=await readFile(file),hash=digest(bytes);await store.putAsset(hash,ext,bytes);return hash;}
// Input URLs come only from owned job records. Download before invoking ffmpeg: no remote protocols in filters.
export async function downloadOwned(url:string,file:string,maxBytes=100*1024*1024){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(45000)});if(!r.ok||!r.body)throw new WaveSpeedError('MEDIA_UNAVAILABLE');const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>maxBytes){await reader.cancel();throw new WaveSpeedError('MEDIA_TOO_LARGE');}chunks.push(x.value);}await writeFile(file,Buffer.concat(chunks));}
export async function normalizeVideo(input:string,output:string,start:number,end:number){await run(['-i',input,'-ss',String(start),'-t',String(end-start),'-map','0:v:0','-vf',fit,...encode,'-an','-movflags','+faststart',output]);}
export async function speechTrack(dir:string,store:R2VideoStore,lines:SceneLine[],ids:Record<string,string>,duration:number,trimStart:number,selected?:(l:SceneLine)=>boolean){
 const used=lines.map((line,index)=>({line,index})).filter(x=>!selected||selected(x.line)),out=join(dir,'speech-'+Math.random().toString(36).slice(2)+'.wav');
 if(!used.length){await run(['-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',String(duration),'-c:a','pcm_s16le',out]);return out;}
 const args:string[]=[],filters:string[]=[];
 for(let j=0;j<used.length;j++){const {line,index}=used[j],p=join(dir,`line-${index}.mp3`);await writeFile(p,await store.dialogueAudio(ids[String(index)]));args.push('-i',p);filters.push(`[${j}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${Math.round((line.offset-trimStart)*1000)}:all=1[a${j}]`);}
 filters.push(used.map((_,j)=>`[a${j}]`).join('')+`amix=inputs=${used.length}:normalize=0,apad,atrim=0:${duration}[out]`);
 await run([...args,'-filter_complex',filters.join(';'),'-map','[out]','-c:a','pcm_s16le',out]);return out;
}
export async function mixVideo(video:string,original:string,dialogue:string,out:string,mix:MixSettings,start:number,duration:number){
 // Probe audio with ffmpeg itself, avoiding a second platform binary.
 let hasAudio=false;try{const r=await exec(ffmpeg!,['-hide_banner','-i',original,'-t','0','-f','null','-'],{timeout:10000,maxBuffer:1024*1024});hasAudio=/Audio:/.test(r.stderr);}catch{/* unsupported source: synthesize silence */}
 const args=['-i',video,'-i',dialogue],filters:string[]=[];
 if(hasAudio&&mix.sourceSpeech!=='mute'){args.push('-i',original);filters.push(`[2:a]atrim=start=${start}:duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${mix.background}[bed]`);}else{args.push('-f','lavfi','-i','anullsrc=r=48000:cl=stereo');filters.push(`[2:a]atrim=0:${duration}[bed]`);}
 filters.push(`[1:a]volume=${mix.voice},asplit=2[sc][speech]`,'[bed][sc]sidechaincompress=threshold=0.025:ratio=5:attack=15:release=280[duck]','[duck][speech]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false[a]');
 await run([...args,'-filter_complex',filters.join(';'),'-map','0:v:0','-map','[a]','-vf',fit,...encode,'-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',String(duration),'-movflags','+faststart',out]);
}

export async function concatenate(files:string[],out:string,durations:number[]){
 const list=join(files[0].slice(0,files[0].lastIndexOf('/')),'concat.txt');
 await writeFile(list,files.map((p,i)=>`file '${p}'\nduration ${durations[i]}`).join('\n'));
 await run(['-f','concat','-safe','0','-i',list,'-map','0:v:0','-map','0:a:0','-c:v','copy','-af','alimiter=limit=0.95:level=false','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t',String(durations.reduce((a,b)=>a+b,0)),'-movflags','+faststart',out]);
}
