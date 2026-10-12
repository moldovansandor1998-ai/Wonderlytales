import {beforeEach,it,expect,vi} from 'vitest';
const calls=vi.hoisted(()=>({submit:vi.fn(),price:vi.fn(),balance:vi.fn(),reserve:vi.fn()}));
vi.mock('@/lib/providers/wavespeed',async original=>({...await original<object>(),WaveSpeedClient:class {creativePrice=calls.price;balance=calls.balance;creativeSubmit=calls.submit;}}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:calls.reserve,getProductionBudget:vi.fn()}));
vi.mock('@/lib/ai-video/film-cut-media',async original=>({...await original<object>(),prepareCutCleanup:vi.fn(async()=>({cleanupInput:'prepared',cleanupSeconds:4}))}));
import {advanceCut,advanceCutBatch,cutAction,claimCut} from '@/lib/ai-video/film-cut';
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
it('parallel fixed-camera preparation keeps film order and shares one atomic total budget',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,authorizedUsd:.6,shots:[shot,{...shot,id:'approved-camera',phase:'READY'}, {...shot,id:'later-answer',frameFrom:'approved-camera'}]},r.etag);
 const results=await Promise.allSettled([advanceCut(s as unknown as R2VideoStore,'wf'),advanceCut(s as unknown as R2VideoStore,'wf',2)]);
 expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect(calls.submit).toHaveBeenCalledTimes(1);
 const next=(await s.readRecord()).value;expect(next.chargedUpperUsd).toBeCloseTo(.448);expect(next.index).toBe(0);expect(next.shots[2].asset).toBeUndefined();
});
it('free framing repair is scoped to the reviewed asset and preserves every paid task',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'STOPPED',index:1,chargedUpperUsd:6.881,tasks:{pending:{status:'PROCESSING',price:.04,model:'frame',taskId:'keep-me'}},shots:[{...shot,raw:'raw',cleaned:'clean',asset:'different',lastFrame:'old',phase:'READY'}]},r.etag);
 await expect(cutAction({action:'repair-framing',shotId:shot.id},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');
 const q=await s.readRecord();await s.writeRecord('film-cut',FILM_CUT_ID,{...q.value,shots:[{...q.value.shots[0],asset:'12f29b9fa6187176afbf22cd9e9dc143f9c05d992bd01b15d726f6cbae4ae97a'}]},q.etag);
 const next=(await cutAction({action:'repair-framing',shotId:shot.id},s as unknown as R2VideoStore)).cut!;
 expect(next.chargedUpperUsd).toBe(6.881);expect(next.authorizedUsd).toBe(10);expect(next.tasks.pending.taskId).toBe('keep-me');expect(next.index).toBe(0);
 expect(next.shots[0]).toMatchObject({raw:'raw',cleaned:'clean',framingRepair:'felix-bag',manualReviewRequired:true});expect(next.shots[0].asset).toBeUndefined();expect(calls.submit).not.toHaveBeenCalled();
});
it('returning to a repaired camera uses the corrected last frame, never the contaminated input',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,index:1,shots:[{...shot,id:'camera',phase:'READY',cropPreset:'right',lastFrame:'corrected'},{...shot,id:'answer',image:undefined,frameFrom:'camera'}]},r.etag);
 await advanceCut(s as unknown as R2VideoStore,'wf');expect((await s.readRecord()).value.shots[1].image).toBe('corrected');expect(calls.submit).not.toHaveBeenCalled();
});
it('free closeup rejects stale assets and changes no paid task or spending limit',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0],asset='a'.repeat(64);
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'PAUSED',shots:[{...shot,raw:'raw',cleaned:'clean',asset,check:{passed:false,text:'review'}}]},r.etag);
 await expect(cutAction({action:'crop-closeup',shotId:shot.id,cropPreset:'right',expectedAsset:'b'.repeat(64)},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');
 const c=(await cutAction({action:'crop-closeup',shotId:shot.id,cropPreset:'right',expectedAsset:asset},s as unknown as R2VideoStore)).cut!;
 expect(c.authorizedUsd).toBe(10);expect(c.chargedUpperUsd).toBe(0);expect(c.tasks).toEqual({});expect(c.shots[0]).toMatchObject({raw:'raw',cleaned:'clean',previousAsset:asset,cropPreset:'right',manualReviewRequired:true});expect(c.shots[0].asset).toBeUndefined();expect(calls.submit).not.toHaveBeenCalled();
});
it('radio correction preserves the paid original and charges only one bounded replacement',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0],oldId='shot-11-14';
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'STOPPED',index:1,authorizedUsd:26.9,ceiling:26.9,chargedUpperUsd:9.959,shots:[{...shot,id:'shot-4-2',phase:'READY'},{...shot,id:oldId,seconds:6.125,image:'48724d39ee7bc04f261a158d9eaf074f45cd9fee03ae27eb2acdcd7b594b3ee2'}],tasks:{[oldId+':video']:{status:'READY',model:'avatar',price:.784,taskId:'keep-original',output:'old-raw'}}},r.etag);
 const c=(await cutAction({action:'repair-radio-camera',shotId:oldId},s as unknown as R2VideoStore)).cut!;
 expect(c.shots[1]).toMatchObject({id:oldId+'-approved-camera',image:shot.image,priorVideoCost:.784,manualReviewRequired:true,previousAttempt:{raw:'old-raw'}});expect(c.chargedUpperUsd).toBe(9.959);expect(c.tasks[oldId+':video'].taskId).toBe('keep-original');
 await claimCut(s as unknown as R2VideoStore,'corrected');calls.price.mockResolvedValue(.784);
 await Promise.allSettled([1,2].map(()=>advanceCut(s as unknown as R2VideoStore,'corrected')));expect(calls.submit).toHaveBeenCalledTimes(1);expect((await s.readRecord()).value.chargedUpperUsd).toBeCloseTo(10.743);
});

it('audio audit preserves the master and uses one bounded immutable request per source asset',async()=>{
 const s=memory(),r=await s.readRecord(),asset='a'.repeat(64),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'READY',index:1,master:'original-master',duration:4,shots:[{...shot,kind:'reuse',phase:'READY',asset}],chargedUpperUsd:2},r.etag);
 const queued=(await cutAction({action:'audit-audio'},s as unknown as R2VideoStore)).cut!;
 expect(calls.reserve).toHaveBeenCalledOnce();expect(calls.submit).not.toHaveBeenCalled();expect(queued.master).toBe('original-master');expect(queued.authorizedUsd).toBe(10);expect(queued.chargedUpperUsd).toBe(2);
 expect(queued.shots[0].asset).toBe(asset);await claimCut(s as unknown as R2VideoStore,'audit');calls.price.mockResolvedValue(.004);
 await Promise.allSettled([1,2].map(()=>advanceCut(s as unknown as R2VideoStore,'audit')));
 expect(calls.submit).toHaveBeenCalledTimes(1);expect(calls.reserve).toHaveBeenCalledOnce();expect(calls.reserve).toHaveBeenCalledWith('wavespeed_transcript');
 expect(calls.submit.mock.calls[0]).toEqual(['wavespeed-ai/openai-whisper-with-video',{video:'https://owned.example/voice.wav',language:'auto',task:'transcribe',enable_timestamps:false}]);
 expect((await s.readRecord()).value.chargedUpperUsd).toBeCloseTo(2.004);
});

it('audit recovery preserves uncertain task and skips its asset without resubmission',async()=>{
 const s=memory(),r=await s.readRecord(),asset='a'.repeat(64),shot=r.value.shots[0];
 const task={model:'whisper',status:'UNCERTAIN' as const,price:.01};
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'PAUSED',audioAuditRequested:true,master:'original-master',shots:[{...shot,kind:'reuse',phase:'READY',asset}],tasks:{['audio-audit:'+asset]:task},chargedUpperUsd:2.01},r.etag);
 const c=(await cutAction({action:'audit-audio'},s as unknown as R2VideoStore)).cut!;
 expect(c.tasks['audio-audit:'+asset]).toEqual(task);expect(c.chargedUpperUsd).toBe(2.01);expect(c.shots[0].audioReview?.asset).toBe(asset);
 await claimCut(s as unknown as R2VideoStore,'audit');await advanceCut(s as unknown as R2VideoStore,'audit');
 expect(calls.reserve).not.toHaveBeenCalled();expect(calls.submit).not.toHaveBeenCalled();expect((await s.readRecord()).value.status).toBe('READY');
});

it('complete-film audit bounds concurrent analysis and preserves the existing master',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 const shots=Array.from({length:5},(_,i)=>({...shot,id:'audio-'+i,asset:String(i).repeat(64),phase:'READY' as const}));
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,audioAuditRequested:true,master:'keep-master',shots},r.etag);calls.price.mockResolvedValue(.005);
 await advanceCutBatch(s as unknown as R2VideoStore,'wf');
 expect(calls.submit).toHaveBeenCalledTimes(3);const c=(await s.readRecord()).value;expect(c.chargedUpperUsd).toBeCloseTo(.015);expect(c.master).toBe('keep-master');expect(c.index).toBe(0);
});
it('the car continuity repair cannot exceed the previously approved allowance',async()=>{
 const s=memory(),r=await s.readRecord(),shot=r.value.shots[0];
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'PAUSED',revision:2,index:2,chargedUpperUsd:9.5,shots:[{...shot,scene:2,kind:'reuse',asset:'source',seconds:10},{...shot,scene:6,kind:'action',asset:'old-car'},shot]},r.etag);
 await expect(cutAction({action:'repair-car'},s as unknown as R2VideoStore)).rejects.toThrow('CUT_PRICE_LIMIT');
 expect(calls.submit).not.toHaveBeenCalled();expect(calls.reserve).not.toHaveBeenCalled();expect((await s.readRecord()).value.chargedUpperUsd).toBe(9.5);
});

it('preparing a continuation does not implicitly approve extra spending',async()=>{
 const s=memory(),r=await s.readRecord(),asset='b'.repeat(64);
 await s.writeRecord('film-cut',FILM_CUT_ID,{...r.value,status:'READY',master:asset,shots:r.value.shots.map(s=>({...s,phase:'READY',asset})),chargedUpperUsd:5,extension:{shots:[],ceiling:22.09,preparedAt:'prepared',lastScene:30}},r.etag);
 await expect(cutAction({action:'start-extension',expectedAsset:asset},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');
 await expect(cutAction({action:'start-extension',expectedAsset:asset,maxCostUsd:17},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');
 await expect(cutAction({action:'start-extension',expectedAsset:'a'.repeat(64),maxCostUsd:18},s as unknown as R2VideoStore)).rejects.toThrow('CUT_REVIEW_REQUIRED');
 expect((await s.readRecord()).value.authorizedUsd).toBe(10);expect(calls.submit).not.toHaveBeenCalled();expect(calls.reserve).not.toHaveBeenCalled();
});
