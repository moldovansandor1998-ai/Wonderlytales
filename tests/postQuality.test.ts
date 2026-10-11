import {expect,it,vi} from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn(),characterVoice:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {checkVisualDrift,speechEnable,CHECK_WIDTH,CHECK_HEIGHT,CHECK_FPS} from '@/lib/ai-video/post-quality';
import {lipsyncPayload} from '@/lib/ai-video/post';
import type {PostJob} from '@/lib/ai-video/post-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
const size=CHECK_WIDTH*CHECK_HEIGHT*3;
const source=()=>new Uint8Array(size*CHECK_FPS).fill(90);
it('accepts normal compression noise and a localized mouth edit',()=>{
 const a=source(),b=source().fill(92);
 for(let f=0;f<CHECK_FPS;f++)b.fill(140,f*size+600,f*size+720);
 expect(checkVisualDrift(a,b,1).worstChangedFraction).toBeLessThan(.01);
});
it('rejects broad scene regeneration, including a single bad frame',()=>{
 const a=source(),b=source();b.fill(150,12*size,13*size);
 expect(()=>checkVisualDrift(a,b,1)).toThrow('LIPSYNC_VISUAL_DRIFT');
 expect(()=>checkVisualDrift(a,source().fill(150),1)).toThrow('LIPSYNC_VISUAL_DRIFT');
});
it('rejects missing or shortened output rather than stretching dialogue',()=>{
 expect(()=>checkVisualDrift(source(),new Uint8Array(),1)).toThrow('LIPSYNC_TIMING_CHANGED');
 expect(()=>checkVisualDrift(source(),source().slice(0,size*20),1)).toThrow('LIPSYNC_TIMING_CHANGED');
});
it('edits only spoken intervals, retaining lead-in, pauses, and the hand-off',()=>{
 expect(speechEnable([{start:3,end:5},{start:7,end:8.9}],10)).toBe('between(t,2.940,5.060)+between(t,6.940,8.960)');
 expect(speechEnable([{start:0,end:9.95}],10)).toBe('between(t,0.042,9.917)');
 expect(()=>speechEnable([{start:0,end:11}],10)).toThrow('DIALOGUE_OUTSIDE_TRIM');
});
it('uses dedicated mouth editing without time remapping for one speaker',async()=>{
 const store={assetUrl:vi.fn(async(hash:string)=>'https://owned.example/'+hash)} as unknown as R2VideoStore;
 const payload=await lipsyncPayload({model:'sync/lipsync-2',videoAsset:'raw',speakerAssets:['voice']} as PostJob,store);
 expect(payload).toEqual({video:'https://owned.example/raw',audio:'https://owned.example/voice',sync_mode:'cut_off'});
});
