import {z} from 'zod';
import {downloadProviderMedia} from './media';
import {R2VideoStore,digest} from './storage';
import {CAST,type CastKey} from './episode-shared';
import {references} from './creative';
import {WaveSpeedClient,WaveSpeedError,type CreativeTask} from '../providers/wavespeed';
import {reserveProductionBudget} from '../budget';
import type {VideoElement} from './shared';
export type ElementJob={id:string;character:CastKey;name:string;referenceSha256:string;status:'SUBMITTING'|'PROCESSING'|'READY'|'FAILED'|'UNCERTAIN';taskId?:string;elementId?:string;error?:string;price:number;outputShape?:string};
const model='kwaivgi/kling-elements';
const keys=z.enum(['felix','mira','nera','tilda','oszkar']);
const descriptions:Record<CastKey,string>={felix:'Red fox, green eyes, red cream fur, teal jacket, white T-shirt, dark trousers, backpack.',mira:'Brown rabbit police detective. Match canonical face, ears, fur, uniform and accessories exactly.',nera:'Adult female marten art dealer. Match canonical face, fur, elegant outfit and proportions.',tilda:'Adult female pangolin mechanic. Match canonical scales, face, work apron and glasses.',oszkar:'Young adult male squirrel bicycle courier. Match canonical face, fur, helmet and courier bag.'};
export function elementRecordId(character:CastKey,sha:string){const h=digest(`kling-element-v1:${CAST[character].id}:${sha}`);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;}
export function elementOutput(task:CreativeTask):string|undefined {
 for(const item of task.outputs??[]){let value:unknown=item;if(typeof item==='string'){try{value=JSON.parse(item);}catch{if(/^[A-Za-z0-9_-]{1,160}$/.test(item))return item;}}
  if(value&&typeof value==='object'&&'element_id' in value){const id=String((value as {element_id:unknown}).element_id);if(/^[A-Za-z0-9_-]{1,160}$/.test(id))return id;}
 }return undefined;
}
export async function elementOverview(store:R2VideoStore){const refs=await references(store);return Promise.all((Object.keys(CAST) as CastKey[]).map(async character=>{const sha=refs.find(x=>x.id===CAST[character].id)?.reference?.sha256;const job=sha?(await store.readRecord<ElementJob>('video-element',elementRecordId(character,sha)))?.value:null;return {character,name:CAST[character].name,sha256:sha??null,job:job??null};}));}
export async function resolveElements(store:R2VideoStore,characters:CastKey[]):Promise<VideoElement[]>{
 if(characters.length>3)throw new WaveSpeedError('TOO_MANY_VIDEO_CHARACTERS',409);
 if(!characters.length)return [];
 const rows=await elementOverview(store);return characters.map(k=>{const row=rows.find(r=>r.character===k)!;if(row.job?.status!=='READY'||!row.job.elementId)throw new WaveSpeedError('VIDEO_CHARACTER_REQUIRED',409);return {elementId:row.job.elementId,name:row.name,referenceSha256:row.sha256!};});
}
export async function elementAction(raw:unknown,store:R2VideoStore,provider=new WaveSpeedClient(process.env.WAVESPEED_API_KEY??'')){
 const input=z.object({character:keys,action:z.enum(['create','poll'])}).strict().parse(raw),row=(await elementOverview(store)).find(x=>x.character===input.character)!;
 if(!row.sha256)throw new WaveSpeedError('CHARACTER_REFERENCE_MISSING',409);
 const id=elementRecordId(input.character,row.sha256);
 async function save(job:ElementJob){const prior=await store.readRecord<ElementJob>('video-element',id);if(!await store.writeRecord('video-element',id,job,prior?.etag))throw new WaveSpeedError('SCENE_CHANGED',409);return job;}
 async function finish(job:ElementJob,task:CreativeTask){
  if(task.status==='completed'){let elementId=elementOutput(task);
   if(!elementId)for(const output of task.outputs??[]){if(typeof output==='string'&&output.startsWith('https://')){const data=(await downloadProviderMedia(output,1024*1024)).toString('utf8');elementId=elementOutput({...task,outputs:[data]});if(elementId)break;}}
   return save({...job,taskId:task.id,...(elementId?{status:'READY' as const,elementId}:{status:'UNCERTAIN' as const,error:'ELEMENT_OUTPUT_REVIEW_REQUIRED',outputShape:JSON.stringify((task.outputs??[]).map(x=>typeof x==='object'?Object.keys(x):typeof x==='string'?(x.startsWith('https:')?'https-url':x.slice(0,120)):typeof x))})});}
  return save({...job,taskId:task.id,status:['failed','cancelled','timeout','deleted'].includes(task.status)?'FAILED':'PROCESSING'});
 }
 if(input.action==='poll'){if(row.job?.taskId&&['PROCESSING','UNCERTAIN'].includes(row.job.status))await finish(row.job,await provider.creativeResult(row.job.taskId));return elementOverview(store);}
 if(row.job)return elementOverview(store); // Never resubmit an ambiguous or failed provider request.
 const payload={name:row.name,description:descriptions[input.character],image:await store.imageUrl(row.sha256),element_refer_list:[]};
 const [price,balance]=await Promise.all([provider.creativePrice(model,payload),provider.balance()]);
 if(price>.010001)throw new WaveSpeedError('ELEMENT_PRICE_CHANGED',409);if(balance<price)throw new WaveSpeedError('WAVESPEED_BALANCE_LOW',409);
 let job:ElementJob={id,character:input.character,name:row.name,referenceSha256:row.sha256,status:'SUBMITTING',price};
 if(!await store.writeRecord('video-element',id,job))return elementOverview(store);
 try{await reserveProductionBudget('wavespeed_element');}catch{await save({...job,status:'FAILED',error:'BUDGET_BLOCKED'});throw new WaveSpeedError('BUDGET_BLOCKED',409);}
 try{const task=await provider.creativeSubmit(model,payload);job=await save({...job,taskId:task.id,status:'PROCESSING'});job=await finish(job,task);}catch{const latest=await store.readRecord<ElementJob>('video-element',id);if(!latest?.value.taskId)await save({...job,status:'UNCERTAIN',error:'ELEMENT_SUBMISSION_UNCERTAIN'});}
 return elementOverview(store);
}
