import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/ai-video/creative',()=>({references:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {references} from '@/lib/ai-video/creative';
import {reserveProductionBudget} from '@/lib/budget';
import {elementAction,elementOutput,resolveElements} from '@/lib/ai-video/elements';
import {CAST} from '@/lib/ai-video/episode-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
import type {WaveSpeedClient} from '@/lib/providers/wavespeed';
const sha='a'.repeat(64);
function setup(){const rows=new Map();let n=0;const store={readRecord:vi.fn(async(k:string,id:string)=>structuredClone(rows.get(k+id)??null)),writeRecord:vi.fn(async(k:string,id:string,value:unknown,etag?:string)=>{if(rows.get(k+id)?.etag!==etag)return false;rows.set(k+id,{value:structuredClone(value),etag:String(++n)});return true;}),imageUrl:vi.fn(async()=> 'https://private.test/ref')};const api={creativePrice:vi.fn(async()=>.01),balance:vi.fn(async()=>5),creativeSubmit:vi.fn(async()=>({id:'task-1',status:'completed',outputs:[{element_id:'element-123'}]}))};return {store:store as unknown as R2VideoStore,api:api as unknown as WaveSpeedClient,raw:api};}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(references).mockResolvedValue([{id:CAST.mira.id,name:'Mira',reference:{characterId:CAST.mira.id,name:'Mira',sha256:sha,updatedAt:''}}]);vi.mocked(reserveProductionBudget).mockResolvedValue(undefined);});
it('registers once across concurrent requests and reuses the canonical reference',async()=>{const {store,api,raw}=setup();await Promise.all([0,1].map(()=>elementAction({character:'mira',action:'create'},store,api)));await elementAction({character:'mira',action:'create'},store,api);expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);expect(await resolveElements(store,['mira'])).toEqual([{elementId:'element-123',name:'Mira',referenceSha256:sha}]);});
it('does not repay an ambiguous registration and blocks unregistered video characters',async()=>{const {store,api,raw}=setup();raw.creativeSubmit.mockRejectedValue(new Error('timeout'));await elementAction({character:'mira',action:'create'},store,api);await elementAction({character:'mira',action:'create'},store,api);expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);await expect(resolveElements(store,['mira'])).rejects.toThrow('VIDEO_CHARACTER_REQUIRED');});
it('blocks price rises before spending and never misreads a result URL as an element id',async()=>{const {store,api,raw}=setup();raw.creativePrice.mockResolvedValue(.02);await expect(elementAction({character:'mira',action:'create'},store,api)).rejects.toThrow('ELEMENT_PRICE_CHANGED');expect(raw.creativeSubmit).not.toHaveBeenCalled();expect(elementOutput({id:'task-1',status:'completed',outputs:['https://cdn.test/data.json']})).toBeUndefined();});

it('recovers a matching request without submitting or reserving budget a second time',async()=>{
 const {store,api,raw}=setup();raw.creativeSubmit.mockRejectedValueOnce(new Error('response lost'));
 await elementAction({character:'mira',action:'create'},store,api);
 const recovery=Object.assign(raw,{recentPredictions:vi.fn(async()=>[{id:'recovered',model:'kwaivgi/kling-elements',status:'completed',inputs:{name:'Mira',image:'https://private.test/ref?old=1'}}]),creativeResult:vi.fn(async()=>({id:'recovered',status:'completed',outputs:[{element_id:'mira-element'}]}))});
 await elementAction({character:'mira',action:'recover'},store,api);
 expect(recovery.creativeResult).toHaveBeenCalledWith('recovered');
 expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);
 expect(await resolveElements(store,['mira'])).toEqual([{elementId:'mira-element',name:'Mira',referenceSha256:sha}]);
});
it('does not guess an identity when provider history contains multiple matching submissions',async()=>{
 const {store,api,raw}=setup();raw.creativeSubmit.mockRejectedValueOnce(new Error('response lost'));
 await elementAction({character:'mira',action:'create'},store,api);
 const recovery=Object.assign(raw,{recentPredictions:vi.fn(async()=>['one','two'].map(id=>({id,model:'kwaivgi/kling-elements',status:'completed',inputs:{name:'Mira',image:'https://private.test/ref'}}))),creativeResult:vi.fn()});
 await elementAction({character:'mira',action:'recover'},store,api);
 expect(recovery.creativeResult).not.toHaveBeenCalled();expect(raw.creativeSubmit).toHaveBeenCalledTimes(1);
 await expect(resolveElements(store,['mira'])).rejects.toThrow('VIDEO_CHARACTER_REQUIRED');
});
