import {beforeEach,expect,it,vi} from 'vitest';
import {submitCreative,type CreativeStore} from '@/lib/ai-video/creative';
import type {CreativeJob} from '@/lib/ai-video/creative-shared';
import type {WaveSpeedClient} from '@/lib/providers/wavespeed';
const job:CreativeJob={id:'bbbbbbbb-2026-4011-8010-000000000000',kind:'scene-image',requestHash:'input-hash',createdAt:'2026-10-11',status:'SUBMITTING',model:'bytedance/seedream-v4.5/edit',estimatedCostUsd:.04,prompt:'Felix keeps his exact appearance.'};
let state:{value:CreativeJob;etag:string}|null,n:number;
const store={readRecord:async()=>structuredClone(state),writeRecord:async(_kind:string,_id:string,value:CreativeJob,etag?:string)=>{if(state?.etag!==etag)return false;state={value:structuredClone(value),etag:String(++n)};return true;},importImage:vi.fn()} as unknown as CreativeStore;
const raw={creativePrice:vi.fn(),balance:vi.fn(),creativeSubmit:vi.fn()},api=raw as unknown as WaveSpeedClient,reserve=vi.fn();
beforeEach(()=>{state=null;n=0;vi.clearAllMocks();raw.creativePrice.mockResolvedValue(.04);raw.balance.mockResolvedValue(5);raw.creativeSubmit.mockResolvedValue({id:'one',status:'created'});reserve.mockResolvedValue(undefined);});
it('charges only once for concurrent submissions and reloads',async()=>{
 await Promise.all([submitCreative(job,{},store,api,reserve),submitCreative(job,{},store,api,reserve)]);
 await submitCreative(job,{},store,api,reserve);expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);expect(reserve).toHaveBeenCalledTimes(1);
});
it('retains uncertain submissions without automatic paid retry',async()=>{
 raw.creativeSubmit.mockRejectedValue(new Error('network timeout'));
 expect((await submitCreative(job,{},store,api,reserve)).status).toBe('UNCERTAIN');
 await submitCreative(job,{},store,api,reserve);expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);
});
it('checks the image price, balance and budget before paid submission',async()=>{
 raw.creativePrice.mockResolvedValue(.05);await expect(submitCreative(job,{},store,api,reserve)).rejects.toThrow('CREATIVE_PRICE_TOO_HIGH');
 raw.creativePrice.mockResolvedValue(.04);raw.balance.mockResolvedValue(0);await expect(submitCreative(job,{},store,api,reserve)).rejects.toThrow('WAVESPEED_BALANCE_LOW');
 raw.balance.mockResolvedValue(5);reserve.mockRejectedValue(new Error('limit'));expect((await submitCreative(job,{},store,api,reserve)).status).toBe('BLOCKED_BUDGET');
 expect(raw.creativeSubmit).not.toHaveBeenCalled();
});
