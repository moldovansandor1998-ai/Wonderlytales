import {beforeEach,it,expect,vi} from 'vitest';
const calls=vi.hoisted(()=>({submit:vi.fn(),price:vi.fn(),balance:vi.fn()}));
vi.mock('@/lib/providers/wavespeed',async original=>({...await original<object>(),WaveSpeedClient:class {creativePrice=calls.price;balance=calls.balance;creativeSubmit=calls.submit;}}));
import {advanceCut,cutAction,claimCut} from '@/lib/ai-video/film-cut';
import {makeCutPlan} from '@/lib/ai-video/film-cut-plan';
import {FILM_CUT_ID,type FilmCut} from '@/lib/ai-video/film-cut-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
function memory(){let seq=0;let row={etag:'0',value:{id:FILM_CUT_ID,version:1,status:'RUNNING',budget:'RESERVED',workflowId:'wf',shots:[{...makeCutPlan()[3],image:'a'.repeat(64),audio:'b'.repeat(64),recording:'cached',seconds:4}],index:0,voices:{},refs:{},elements:[],ceiling:10,authorizedUsd:10,chargedUpperUsd:0,tasks:{},createdAt:'today',updatedAt:'today'} as FilmCut};return {readRecord:vi.fn(async()=>structuredClone(row)),writeRecord:vi.fn(async(k:string,id:string,value:FilmCut,etag?:string)=>{if(etag!==row.etag)return false;row={etag:String(++seq),value:structuredClone(value)};return true;}),imageUrl:vi.fn().mockResolvedValue('https://owned.example/frame.jpg'),assetUrl:vi.fn().mockResolvedValue('https://owned.example/voice.wav')};}
beforeEach(()=>{vi.clearAllMocks();calls.price.mockResolvedValue(.448);calls.balance.mockResolvedValue(50);calls.submit.mockResolvedValue({id:'task',status:'processing'});});
it('concurrent advances claim and submit a shot only once',async()=>{const s=memory();await Promise.allSettled([1,2].map(()=>advanceCut(s as unknown as R2VideoStore,'wf')));expect(calls.submit).toHaveBeenCalledTimes(1);expect((await s.readRecord()).value.chargedUpperUsd).toBeCloseTo(.448);expect(calls.submit.mock.calls[0][0]).toBe('kwaivgi/kling-v2-ai-avatar-pro');expect(calls.submit.mock.calls[0][1].prompt).toContain('MANDATORY VISUAL RULE');});
it('a timeout leaves an immutable uncertain task and cannot be resumed or recharged',async()=>{calls.submit.mockRejectedValue(new Error('timeout'));const s=memory();await expect(advanceCut(s as unknown as R2VideoStore,'wf')).rejects.toThrow('CUT_SUBMISSION_UNCERTAIN');await expect(advanceCut(s as unknown as R2VideoStore,'wf')).rejects.toThrow('CUT_SUBMISSION_UNCERTAIN');await cutAction({action:'stop'},s as unknown as R2VideoStore);await expect(cutAction({action:'resume'},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');expect(calls.submit).toHaveBeenCalledTimes(1);});
it('blocks changed provider price before a charge or submit',async()=>{calls.price.mockResolvedValue(.56);const s=memory();await expect(advanceCut(s as unknown as R2VideoStore,'wf')).rejects.toThrow('CUT_PRICE_LIMIT');expect(calls.submit).not.toHaveBeenCalled();expect((await s.readRecord()).value.chargedUpperUsd).toBe(0);});
it('a stopped run or another workflow cannot advance',async()=>{const s=memory();expect(await advanceCut(s as unknown as R2VideoStore,'other')).toBe(true);await cutAction({action:'stop'},s as unknown as R2VideoStore);expect(await advanceCut(s as unknown as R2VideoStore,'wf')).toBe(true);expect(await claimCut(s as unknown as R2VideoStore,'new')).toBe(false);expect(calls.submit).not.toHaveBeenCalled();});
it('text repair preserves paid attempts and approval, then submits cleanup exactly once',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'STOPPED',index:1,chargedUpperUsd:.452,tasks:{[shot.id+':video']:{status:'READY',price:.448,model:'avatar',taskId:'original',output:'raw'}},shots:[{...shot,raw:'raw',asset:'old',lastFrame:'oldFrame',phase:'READY',check:{passed:true,text:'missed caption'}}]},r.etag);
 const repaired=(await cutAction({action:'repair-text',shotId:shot.id},s as unknown as R2VideoStore)).cut!;
 expect(repaired.authorizedUsd).toBe(10);expect(repaired.chargedUpperUsd).toBe(.452);expect(repaired.tasks[shot.id+':video'].taskId).toBe('original');
 expect(repaired.shots[0]).toMatchObject({raw:'raw',previousAsset:'old',manualReviewRequired:true});expect(repaired.shots[0].asset).toBeUndefined();expect(repaired.index).toBe(0);
 await claimCut(s as unknown as R2VideoStore,'repair');calls.price.mockResolvedValue(.04);
 await Promise.allSettled([1,2].map(()=>advanceCut(s as unknown as R2VideoStore,'repair')));
 expect(calls.submit).toHaveBeenCalledTimes(1);expect(calls.submit.mock.calls[0][0]).toBe('wavespeed-ai/video-watermark-remover');expect((await s.readRecord()).value.chargedUpperUsd).toBeCloseTo(.492);
});
it('cleanup cannot exceed the original approved total or the reserved video slot',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,authorizedUsd:.46,chargedUpperUsd:.448,tasks:{[shot.id+':video']:{status:'READY',price:.448,model:'avatar'}},shots:[{...shot,raw:'raw'}]},r.etag);
 calls.price.mockResolvedValue(.04);await expect(advanceCut(s as unknown as R2VideoStore,'wf')).rejects.toThrow('CUT_PRICE_LIMIT');expect(calls.submit).not.toHaveBeenCalled();
 const q=await s.readRecord();await s.writeRecord('film-cut',FILM_CUT_ID,{...q.value,authorizedUsd:10,tasks:{[shot.id+':video']:{status:'READY',price:1.68,model:'avatar'}}},q.etag);
 await expect(advanceCut(s as unknown as R2VideoStore,'wf')).rejects.toThrow('CUT_PRICE_LIMIT');expect(calls.submit).not.toHaveBeenCalled();
});
