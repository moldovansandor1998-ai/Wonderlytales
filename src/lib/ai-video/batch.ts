import {randomUUID} from 'node:crypto';
import {R2VideoStore,digest} from './storage';
import {CAST,type SceneState,type CastKey} from './episode-shared';
import {EPISODE_SCENES} from './episode-data';
import {postContext} from './post-core';
import {checkAutomaticVoices,automaticSourceHash,advanceAutomatic} from './automatic';
import type {AutoRun} from './automatic-shared';
import {postCostCeiling} from './automatic-shared';
import {readCast,characterVoice} from './voices';
import {getProductionBudget,reserveProductionBudget} from '../budget';
import {WaveSpeedError} from '../providers/wavespeed';
import {resolveElements} from './elements';
import {preserveVideo} from './archive';
import {finalFrame} from './post-media';
import type {VideoElement} from './shared';

export const BATCH_ID='00000000-0000-4000-8000-000000000010';
type Item={id:string;sourceHash:string;videoId:string;runId:string;regenerate:boolean;continuous:boolean;elements:VideoElement[];phase:'WAITING'|'PROCESSING'|'READY';finalAsset?:string};
export type Batch={id:string;items:Item[];index:number;status:'RESERVING'|'QUEUED'|'RUNNING'|'PAUSED'|'READY'|'STOPPED';workflowId?:string;budget:'CLAIMED'|'RESERVED'|'UNCERTAIN';voices:Record<CastKey,string|null>;voiceRows:AutoRun['voiceRows'];maxCostUsd:number;error?:string;updatedAt:string;createdAt:string};
const now=()=>new Date().toISOString();
export function batchSourceHash(s:SceneState){return digest(JSON.stringify({prompt:s.prompt,characters:s.characters,dialogue:s.dialogue,trim:[s.trimStart,s.trimEnd],sound:s.sound,mode:s.mode,sceneBreak:s.sceneBreak}));}
export async function readBatch(store:R2VideoStore){return (await store.readRecord<Batch>('auto-batch',BATCH_ID))?.value??null;}
export function publicBatch(b:Batch|null){return b?{id:b.id,status:b.status,index:b.index,maxCostUsd:b.maxCostUsd,error:b.error,updatedAt:b.updatedAt,items:b.items.map(i=>({id:i.id,phase:i.phase,finalAsset:i.finalAsset}))}:null;}
export function orderedSelection(ids:string[]){
 const defs=ids.map(id=>EPISODE_SCENES.find(d=>d.id===id));
 if(!ids.length||ids.length>10||new Set(ids).size!==ids.length||defs.some(d=>!d))throw new WaveSpeedError('INVALID_INPUT',400);
 const sorted=defs.map(d=>d!).sort((a,b)=>a.order-b.order);
 if(sorted.some((d,i)=>i>0&&d.order!==sorted[i-1].order+1))throw new WaveSpeedError('BATCH_CONTIGUOUS_REQUIRED',409);
 return sorted;
}
export async function startBatch(store:R2VideoStore,ids:string[],regenerate:boolean,maxCostUsd:number){
 const old=await store.readRecord<Batch>('auto-batch',BATCH_ID);
 if(old&&!['READY','STOPPED'].includes(old.value.status))throw new WaveSpeedError('BATCH_ACTIVE',409);
 const defs=orderedSelection(ids),contexts=await Promise.all(defs.map(d=>checkAutomaticVoices(store,d.id,'hu')));
 const voices=contexts[0].voices,voiceRows:AutoRun['voiceRows']={};
 const cast=await readCast();
 for(const c of contexts)for(const l of c.state.dialogue){const character=cast.characters.find(x=>x.id===CAST[l.character].id),voice=character&&characterVoice(character,cast.voices);if(!voice||voice.voice_id!==voices[l.character])throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);voiceRows[CAST[l.character].id]={id:voice.id,voice_id:voice.voice_id};}
 const services:string[]=[],items:Item[]=[];
 for(const [i,c] of contexts.entries()){
  const s=c.state,raw=s.videoJobId?(await store.read(s.videoJobId))?.job:null;
  if(s.videoJobId&&(!raw||!['COMPLETED','FAILED','CANCELLED','BLOCKED_BUDGET'].includes(raw.status)))throw new WaveSpeedError('JOB_ACTIVE',409);
  if(s.review==='needs-work'&&!regenerate)throw new WaveSpeedError('SCENE_VISUAL_REVIEW_REQUIRED',409);
  const makeMotion=regenerate||!s.videoJobId,continuous=makeMotion&&c.definition.kind==='story'&&c.definition.order>1;
  if(makeMotion&&c.definition.kind==='intro')throw new WaveSpeedError('EXISTING_INTRO',409);
  if(makeMotion&&!continuous&&s.mode==='image'&&(i>0||!s.sceneBreak||!s.imageApproved||!s.imageSha256))throw new WaveSpeedError('BATCH_SCENE_BREAK',409);
  if(makeMotion&&(continuous||s.mode==='last-frame')&&i===0){
   const previous=EPISODE_SCENES[c.definition.order-1];if(!previous)throw new WaveSpeedError('PREVIOUS_VIDEO_REQUIRED',409);
   const p=await postContext(store,previous.id,'hu',voices);
   if(p.state.review==='needs-work'||p.job?.status!=='READY'||!p.job.finalAsset||p.job.fingerprint!==p.fingerprint)throw new WaveSpeedError('BATCH_PREVIOUS_FINAL_REQUIRED',409);
  }
  const ready=!makeMotion&&c.job?.status==='READY'&&c.job.fingerprint===c.fingerprint&&!!c.job.finalAsset;
  if(makeMotion)services.push('wavespeed_kling');
  if(!ready){services.push(...s.dialogue.map(()=> 'tts_dialogue'));if(s.dialogue.some(l=>l.delivery==='visible'))services.push('wavespeed_analysis','wavespeed_lipsync');}
  items.push({id:s.id,sourceHash:batchSourceHash(continuous?{...s,mode:'last-frame',sceneBreak:false}:s),continuous,videoId:makeMotion?randomUUID():s.videoJobId!,runId:randomUUID(),regenerate:makeMotion,elements:makeMotion?await resolveElements(store,s.characters):[],phase:ready?'READY':'WAITING',...(ready?{finalAsset:c.job!.finalAsset}:{})});
 }
 const ceilings:Record<string,number>={wavespeed_kling:1.68,tts_dialogue:.25,wavespeed_analysis:.02,wavespeed_lipsync:.66};
 const cost=services.reduce((sum,s)=>sum+ceilings[s],0),budget=services.length?await getProductionBudget():null;
 if(cost>maxCostUsd+.000001)throw new WaveSpeedError('PRICE_CHANGED',409);
 if(services.length&&(!budget||services.some(s=>budget.configured_services[s]!==ceilings[s])))throw new WaveSpeedError('BUDGET_NOT_CONFIGURED',409);
 if(budget&&cost>budget.remaining_usd+.000001)throw new WaveSpeedError('BUDGET_BLOCKED',409);
 let b:Batch={id:randomUUID(),items,index:0,status:'RESERVING',budget:'CLAIMED',voices,voiceRows,maxCostUsd:Math.round(cost*100)/100,createdAt:now(),updatedAt:now()};
 if(!await store.writeRecord('auto-batch',BATCH_ID,b,old?.etag))throw new WaveSpeedError('BATCH_ACTIVE',409);
 try{for(const service of services)await reserveProductionBudget(service);b={...b,budget:'RESERVED',status:'QUEUED'};}
 catch{b={...b,budget:'UNCERTAIN',status:'PAUSED',error:'AUTO_BUDGET_UNCERTAIN'};}
 const saved=await store.readRecord<Batch>('auto-batch',BATCH_ID);
 if(!saved||saved.value.id!==b.id||!await store.writeRecord('auto-batch',BATCH_ID,b,saved.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
 if(b.budget!=='RESERVED')throw new WaveSpeedError('AUTO_BUDGET_UNCERTAIN',409);
 return b;
}
export async function updateBatch(store:R2VideoStore,id:string,patch:Partial<Batch>,workflowId?:string){
 const old=await store.readRecord<Batch>('auto-batch',BATCH_ID);if(!old||old.value.id!==id||(workflowId&&old.value.workflowId!==workflowId))return false;
 return store.writeRecord('auto-batch',BATCH_ID,{...old.value,...patch,updatedAt:now()},old.etag);
}
export async function claimBatch(store:R2VideoStore,id:string,workflowId:string){
 const old=await store.readRecord<Batch>('auto-batch',BATCH_ID),b=old?.value;
 if(!b||b.id!==id||b.budget!=='RESERVED'||!['QUEUED','PAUSED','RUNNING'].includes(b.status))return false;
 if(b.workflowId&&b.workflowId!==workflowId&&b.status!=='PAUSED')return false;
 return store.writeRecord('auto-batch',BATCH_ID,{...b,status:'RUNNING',workflowId,error:undefined,updatedAt:now()},old!.etag);
}
export async function advanceBatch(store:R2VideoStore,id:string,workflowId:string){
 const b=await readBatch(store);if(!b||b.id!==id||b.workflowId!==workflowId||b.status!=='RUNNING')return true;
 if(b.index>=b.items.length){await updateBatch(store,id,{status:'READY'},workflowId);return true;}
 const item=b.items[b.index];
 const c=await postContext(store,item.id,'hu',b.voices);
 if(batchSourceHash(item.continuous?{...c.state,mode:'last-frame',sceneBreak:false}:c.state)!==item.sourceHash)throw new WaveSpeedError('AUTO_SOURCE_CHANGED',409);
 if(item.phase==='READY'){
  if(c.job?.status!=='READY'||c.job.fingerprint!==c.fingerprint||c.job.finalAsset!==item.finalAsset)throw new WaveSpeedError('AUTO_SOURCE_CHANGED',409);
  await updateBatch(store,id,{index:b.index+1},workflowId);return false;
 }
 if(item.regenerate&&c.state.videoJobId!==item.videoId){
  let image=c.state.imageSha256,sourceAsset:string|undefined,sourceJobId:string|undefined,sourceTime:number|undefined;
  if(item.continuous||c.state.mode==='last-frame'){
   const prior=EPISODE_SCENES[c.definition.order-1],p=await postContext(store,prior.id,'hu',b.voices);
   if(p.state.review==='needs-work'||p.job?.status!=='READY'||!p.job.finalAsset||p.job.fingerprint!==p.fingerprint)throw new WaveSpeedError('BATCH_PREVIOUS_FINAL_REQUIRED',409);
   sourceAsset=p.job.finalAsset;sourceJobId=p.state.videoJobId;sourceTime=p.job.duration;image=await finalFrame(store,sourceAsset);
   const fresh=await postContext(store,prior.id,'hu',b.voices);if(fresh.job?.finalAsset!==sourceAsset||fresh.job.fingerprint!==fresh.fingerprint)throw new WaveSpeedError('PREVIOUS_VIDEO_CHANGED',409);
  }
  if(!image)throw new WaveSpeedError('IMAGE_REQUIRED',409);
  if(c.state.videoJobId)await preserveVideo(store,c.state.videoJobId);
  const saved=await store.readRecord<SceneState>('episode-scene',item.id);
  if((saved?.value.revision??0)!==c.state.revision)throw new WaveSpeedError('SCENE_CHANGED',409);
  const state:SceneState={...c.state,...(item.continuous?{mode:'last-frame' as const,sceneBreak:false}:{}),imageSha256:image,imageApproved:true,sourceAsset,sourceJobId,sourceTime,videoJobId:item.videoId,videoRequest:{id:item.videoId,elements:item.elements,imageSha256:image,prompt:c.state.prompt,duration:10,sound:c.state.sound,maxCostUsd:1.68},review:'pending',videoHistory:[...new Set([...c.state.videoHistory,...(c.state.videoJobId?[c.state.videoJobId]:[])])],imageHistory:[...new Set([...c.state.imageHistory,...(c.state.imageSha256?[c.state.imageSha256]:[])])],revision:c.state.revision+1,updatedAt:now()};
  if(!await store.writeRecord('episode-scene',item.id,state,saved?.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
  return false;
 }
 if(item.regenerate&&c.state.mode==='last-frame'){const prior=EPISODE_SCENES[c.definition.order-1],p=await postContext(store,prior.id,'hu',b.voices);if(p.state.review==='needs-work'||p.job?.fingerprint!==p.fingerprint||p.job?.finalAsset!==c.state.sourceAsset)throw new WaveSpeedError('PREVIOUS_VIDEO_CHANGED',409);}
 if(c.state.videoJobId!==item.videoId)throw new WaveSpeedError('AUTO_SOURCE_CHANGED',409);
 let run=(await store.readRecord<AutoRun>('auto-run',item.runId))?.value;
 if(!run){
  run={id:item.runId,sceneId:item.id,language:'hu',sourceHash:automaticSourceHash(c),videoId:item.videoId,createdAt:now(),updatedAt:now(),phase:'QUEUED',workflowId,budget:'RESERVED',services:[],voices:b.voices,voiceRows:b.voiceRows,maxPostCostUsd:postCostCeiling(c.state.dialogue)};
  await store.writeRecord('auto-run',item.runId,run);
 }else if(run.workflowId!==workflowId){const old=await store.readRecord<AutoRun>('auto-run',item.runId);if(!old||!await store.writeRecord('auto-run',item.runId,{...old.value,workflowId},old.etag))throw new WaveSpeedError('SCENE_CHANGED',409);}
 if(await advanceAutomatic(store,item.runId,workflowId)){
  const ready=(await store.readRecord<AutoRun>('auto-run',item.runId))?.value;
  if(ready?.phase!=='READY'||!ready.finalAsset)throw new WaveSpeedError('AUTO_PROVIDER_UNCERTAIN',409);
  await preserveVideo(store,item.videoId);
  await updateBatch(store,id,{items:b.items.map((x,i)=>i===b.index?{...x,phase:'READY',finalAsset:ready.finalAsset}:x),index:b.index+1},workflowId);
 }else if(item.phase==='WAITING')await updateBatch(store,id,{items:b.items.map((x,i)=>i===b.index?{...x,phase:'PROCESSING'}:x)},workflowId);
 return false;
}
