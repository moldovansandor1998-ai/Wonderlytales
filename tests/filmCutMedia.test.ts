import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareCutCleanup,finishCutShot,mediaInfo} from '../src/lib/ai-video/film-cut-media';
import type {CutShot} from '../src/lib/ai-video/film-cut-shared';
import type {R2VideoStore} from '../src/lib/ai-video/storage';

const ffmpeg=join(process.cwd(),'node_modules/ffmpeg-static/ffmpeg'),exec=promisify(execFile);
describe.runIf(existsSync(ffmpeg))('speech video frame rounding',()=>{
 let dir:string;
 const assets=new Map<string,Buffer>();
 const store={assetBytes:async(hash:string)=>assets.get(hash)!,putAsset:async(hash:string,_ext:string,bytes:Buffer)=>{assets.set(hash,bytes);}} as unknown as R2VideoStore;
 const shot={kind:'speech',seconds:91/24,audio:'voice',raw:'raw'} as CutShot;
 beforeAll(async()=>{
  dir=await mkdtemp(join(tmpdir(),'cut-frame-test-'));
  // Reproduce a 112-frame / 30 fps provider output for a 91-frame / 24 fps shot.
  await exec(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','testsrc2=s=64x64:r=30','-frames:v','112','-c:v','libx264','-pix_fmt','yuv420p',join(dir,'raw.mp4')]);
  await exec(ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-af','apad','-t',String(shot.seconds),join(dir,'voice.wav')]);
  assets.set('raw',await readFile(join(dir,'raw.mp4')));assets.set('voice',await readFile(join(dir,'voice.wav')));
 });
 afterAll(async()=>{if(dir)await rm(dir,{recursive:true,force:true});});
 it('holds the tiny visual tail before cleanup and preserves the full assigned audio',async()=>{
  const cleanup=await prepareCutCleanup(store,shot);
  expect(cleanup.cleanupSeconds).toBeCloseTo(shot.seconds,1);
  const finished=await finishCutShot(store,{...shot,cleaned:cleanup.cleanupInput});
  const out=join(dir,'finished.mp4');await writeFile(out,assets.get(finished.asset)!);
  const info=await mediaInfo(out);expect(info.audio).toBe(true);expect(info.duration).toBeCloseTo(shot.seconds,1);
  await exec(ffmpeg,['-nostdin','-v','error','-i',out,'-f','null','-']);
 },15000);
 it('still rejects missing action footage, unassigned speech, and larger gaps',async()=>{
  await expect(prepareCutCleanup(store,{...shot,kind:'action'})).rejects.toThrow('CUT_VIDEO_TOO_SHORT');
  await expect(prepareCutCleanup(store,{...shot,audio:undefined})).rejects.toThrow('CUT_VIDEO_TOO_SHORT');
  await expect(prepareCutCleanup(store,{...shot,seconds:4})).rejects.toThrow('CUT_VIDEO_TOO_SHORT');
 });
});
