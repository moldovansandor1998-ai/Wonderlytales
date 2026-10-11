import {it,expect} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {extractFinalFrame,tempMedia} from '@/lib/ai-video/post-media';
import type {R2VideoStore} from '@/lib/ai-video/storage';
it('takes the actual final decoded frame of the finished MP4',async()=>{
 const exec=promisify(execFile),ffmpeg=join(process.cwd(),'node_modules/ffmpeg-static/ffmpeg');
 await tempMedia(async dir=>{
  const video=join(dir,'moving.mp4'),reference=join(dir,'frame-47.png');
  await exec(ffmpeg,['-hide_banner','-y','-f','lavfi','-i','testsrc2=size=320x320:rate=24:duration=2','-c:v','libx264','-pix_fmt','yuv420p',video]);
  await exec(ffmpeg,['-hide_banner','-y','-i',video,'-vf','select=eq(n\\,47)','-frames:v','1',reference]);
  const store={assetBytes:async()=>readFile(video)} as unknown as R2VideoStore;
  const actual=await extractFinalFrame(store,'owned-final-asset');
  expect(actual.equals(await readFile(reference))).toBe(true);
 });
},15000);
