import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/ai-video/creative',()=>({references:vi.fn()}));
vi.mock('@/lib/ai-video/media',()=>({downloadProviderMedia:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {downloadProviderMedia} from '@/lib/ai-video/media';
import {references} from '@/lib/ai-video/creative';
import {reserveProductionBudget} from '@/lib/budget';
import {elementAction,elementOutput,resolveElements} from '@/lib/ai-video/elements';
import {CAST} from '@/lib/ai-video/episode-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
import type {WaveSpeedClient} from '@/lib/providers/wavespeed';
const sha='a'.repeat(64);
function setup(){const rows=new Map();let n=0;const store={readRecord:vi.fn(async(k:string,id:string)=>structuredClone(rows.get(k+id)??null)),writeRecord:vi.fn(async(k:string,id:string,value:unknown,etag?:string)=>{if(rows.get(k+id)?.etag!==etag)return false;rows.set(k+id,{value:structuredClone(value),etag:String(++n)});return true;}),imageUrl:vi.fn(async()=> 'https://private.test/ref')};const api={elementHistory:vi.fn(async()=>[]),creativePrice:vi.fn(async()=>.01),balance:vi.fn(async()=>5),elementSubmit:vi.fn(async()=>({task:{id:'task-1',status:'completed',outputs:[{element_id:'element-123'}]}}))};return {store:store as unknown as R2VideoStore,api:api as unknown as WaveSpeedClient,raw:api};}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(references).mockResolvedValue([{id:CAST.mira.id,name:'Mira',reference:{characterId:CAST.mira.id,name:'Mira',sha256:sha,updatedAt:''}}]);vi.mocked(reserveProductionBudget).mockResolvedValue(undefined);});
it('registers once across concurrent requests and reuses the canonical reference',async()=>{const {store,api,raw}=setup();await Promise.all([0,1].map(()=>elementAction({character:'mira',action:'create'},store,api)));await elementAction({character:'mira',action:'create'},store,api);expect(raw.elementSubmit).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);expect(await resolveElements(store,['mira'])).toEqual([{elementId:'element-123',name:'Mira',referenceSha256:sha}]);});
it('does not repay an ambiguous registration and blocks unregistered video characters',async()=>{const {store,api,raw}=setup();raw.elementSubmit.mockRejectedValue(new Error('timeout'));await elementAction({character:'mira',action:'create'},store,api);await elementAction({character:'mira',action:'create'},store,api);expect(raw.elementSubmit).toHaveBeenCalledTimes(1);await expect(resolveElements(store,['mira'])).rejects.toThrow('VIDEO_CHARACTER_REQUIRED');});
it('blocks price rises before spending and never misreads a result URL as an element id',async()=>{const {store,api,raw}=setup();raw.creativePrice.mockResolvedValue(.02);await expect(elementAction({character:'mira',action:'create'},store,api)).rejects.toThrow('ELEMENT_PRICE_CHANGED');expect(raw.elementSubmit).not.toHaveBeenCalled();expect(elementOutput({id:'task-1',status:'completed',outputs:['https://cdn.test/data.json']})).toBeUndefined();});

it('resolves a hosted JSON result using the saved task without another paid submission',async()=>{
 const {store,api,raw}=setup();raw.elementSubmit.mockResolvedValue({task:{id:'task-1',status:'completed',outputs:['https://cdn.wavespeed.ai/element.json']}} as never);
 vi.mocked(downloadProviderMedia).mockResolvedValue(Buffer.from(JSON.stringify({element_id:'hosted-element-9'})));
 await elementAction({character:'mira',action:'create'},store,api);
 expect((await resolveElements(store,['mira']))[0].elementId).toBe('hosted-element-9');expect(raw.elementSubmit).toHaveBeenCalledTimes(1);
});

it('permits only one explicit bounded repair after history lookup, preserving the old attempt',async()=>{
 const {store,api,raw}=setup();raw.elementSubmit.mockRejectedValueOnce(new Error('timeout'));
 await elementAction({character:'mira',action:'create'},store,api);
 await expect(elementAction({character:'mira',action:'retry'},store,api)).rejects.toThrow('ELEMENT_MANUAL_RETRY_BLOCKED');
 await elementAction({character:'mira',action:'recover'},store,api);
 const results=await Promise.allSettled([0,1].map(()=>elementAction({character:'mira',action:'retry',allowOneAdditionalCharge:true},store,api)));
 expect(results.some(r=>r.status==='fulfilled')).toBe(true);expect(raw.elementSubmit).toHaveBeenCalledTimes(2);
 await expect(elementAction({character:'mira',action:'retry',allowOneAdditionalCharge:true},store,api)).rejects.toThrow('ELEMENT_MANUAL_RETRY_BLOCKED');
});
