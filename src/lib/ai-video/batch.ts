import {randomUUID} from 'node:crypto';
import {R2VideoStore,digest} from './storage';
import {EPISODE_SCENES} from './episode-data';
import {episodeScene} from './episode';
import {checkAutomaticVoices,automaticSourceHash,advanceAutomatic,claimAutomatic,readAutomatic,pauseAutomatic} from './automatic';
import {postContext,requirePreviousApproval} from './post-core';
import {readCast,characterVoice} from './voices';
import {resolveElements} from './elements';
import {CAST,type SceneState} from './episode-shared';
import {WaveSpeedError} from '../providers/wavespeed';
import {getProductionBudget,reserveProductionBudget} from '../budget';
import {postCostCeiling,type AutoRun} from './automatic-shared';
import type {BatchRun,BatchItem} from './batch-shared';
import {extractFinalFrame} from './post-media';
const INDEX='a1709001-2026-4011-8010-000000000060';
export function batchSelection(ids:string[]){const scenes=ids.map(id=>EPISODE_SCENES.find(s=>s.id===id)).sort((a,b)=>(a?.order??0)-(b?.order??0));if(!ids.length||ids.length>10||new Set(ids).size!==ids.length||scenes.some((s,i)=>!s||s.kind==='intro'||i>0&&s.order!==scenes[i-1]!.order+1))throw new WaveSpeedError('BATCH_CONSECUTIVE',400);return scenes as NonNullable<(typeof scenes)[number]>[];}
export async function readBatch(store:R2VideoStore){const index=await store.readRecord<{runId:string}>('auto-batch-index',INDEX);return index?(await store.readRecord<BatchRun>('auto-batch',index.value.runId))?.value??null:null;}
export function publicBatch(b:BatchRun|null){return b?{id:b.id,status:b.status,cursor:b.cursor,error:b.error,maxCostUsd:b.maxCostUsd,items:b.items.map(i=>({sceneId:i.sceneId,title:i.title,finalAsset:i.finalAsset}))}:null;}
export async function authorizeBatch(store:R2VideoStore,ids:string[],requestId:string,maxCostUsd:number){
 const definitions=batchSelection(ids),existing=await store.readRecord<BatchRun>('auto-batch',requestId);
 if(existing){if(JSON.stringify(existing.value.items.map(i=>i.sceneId))!==JSON.stringify(definitions.map(d=>d.id)))throw new WaveSpeedError('INVALID_INPUT',400);if(existing.value.budget!=='RESERVED')throw new WaveSpeedError('AUTO_BUDGET_UNCERTAIN',409);return existing.value;}
 const current=await readBatch(store);if(current&&['QUEUED','RUNNING'].includes(current.status))throw new WaveSpeedError('BATCH_ACTIVE',409);
 await requirePreviousApproval(store,definitions[0].order);
 const contexts=await Promise.all(definitions.map(d=>checkAutomaticVoices(store,d.id,'hu')));
 const first=contexts[0].state;if(!first.imageSha256||!first.imageApproved)throw new WaveSpeedError('BATCH_START_IMAGE',409);
 if(first.mode==='last-frame'){const prev=await postContext(store,EPISODE_SCENES[definitions[0].order-1].id,'hu');if(first.sourceAsset!==prev.job?.finalAsset||first.sourceJobId!==prev.state.videoJobId)throw new WaveSpeedError('PREVIOUS_VIDEO_CHANGED',409);}
 const price=contexts.reduce((sum,c)=>sum+1.68+postCostCeiling(c.state.dialogue),0);
 if(price>maxCostUsd+.000001)throw new WaveSpeedError('PRICE_CHANGED',409);
 const items:BatchItem[]=[];
 for(const c of contexts){
  const [raw,auto]=await Promise.all([c.state.videoJobId?store.read(c.state.videoJobId):null,readAutomatic(store,c.state.id,'hu')]);
  if(raw&&['SUBMITTING','RUNNING','QUEUED','SUBMISSION_UNCERTAIN'].includes(raw.job.status)||auto&&!['READY','PAUSED'].includes(auto.phase))throw new WaveSpeedError('JOB_ACTIVE',409);
  items.push({sceneId:c.state.id,title:c.definition.title,original:c.state,videoId:randomUUID(),autoRunId:randomUUID(),elements:await resolveElements(store,c.state.characters)});
 }
 const {characters,voices}=await readCast(),voiceRows:AutoRun['voiceRows']={};
 for(const c of contexts)for(const l of c.state.dialogue){const character=characters.find(x=>x.id===CAST[l.character].id),v=character&&characterVoice(character,voices);if(!v||v.voice_id!==c.voices[l.character])throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);voiceRows[CAST[l.character].id]={id:v.id,voice_id:v.voice_id};}
 const services=contexts.flatMap(c=>['wavespeed_kling',...c.state.dialogue.map(()=> 'tts_dialogue'),...(c.state.dialogue.some(l=>l.delivery==='visible')?['wavespeed_analysis','wavespeed_lipsync']:[])]);
 const caps:Record<string,number>={wavespeed_kling:1.68,tts_dialogue:.25,wavespeed_analysis:.02,wavespeed_lipsync:.66},budget=await getProductionBudget();
 if(!budget||services.some(s=>budget.configured_services[s]!==caps[s]))throw new WaveSpeedError('BUDGET_NOT_CONFIGURED',409);
 if(budget.remaining_usd+.000001<price)throw new WaveSpeedError('BUDGET_BLOCKED',409);
 const now=new Date().toISOString();let batch:BatchRun={id:requestId,items,cursor:0,status:'QUEUED',budget:'CLAIMED',voices:contexts[0].voices,voiceRows,createdAt:now,updatedAt:now,maxCostUsd:price};
 // Claim the owner-scoped queue before reserving anything, preventing concurrent batches.
 const index=await store.readRecord<{runId:string}>('auto-batch-index',INDEX);
 if(index?.value.runId!==current?.id)throw new WaveSpeedError('BATCH_ACTIVE',409);
 if(!await store.writeRecord('auto-batch',requestId,batch))throw new WaveSpeedError('BATCH_ACTIVE',409);
 if(!await store.writeRecord('auto-batch-index',INDEX,{runId:requestId},index?.etag))throw new WaveSpeedError('BATCH_ACTIVE',409);
 const saved=(await store.readRecord<BatchRun>('auto-batch',requestId))!;
 try{for(const service of services)await reserveProductionBudget(service);batch={...batch,budget:'RESERVED'};}
 catch{batch={...batch,budget:'UNCERTAIN',status:'PAUSED',error:'AUTO_BUDGET_UNCERTAIN'};}
 if(!await store.writeRecord('auto-batch',requestId,batch,saved.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
 if(batch.budget!=='RESERVED')throw new WaveSpeedError('AUTO_BUDGET_UNCERTAIN',409);
 return batch;
}
export async function claimBatch(store:R2VideoStore,id:string,workflowId:string){const old=await store.readRecord<BatchRun>('auto-batch',id);if(!old||old.value.budget!=='RESERVED'||old.value.status==='READY'||old.value.workflowId&&old.value.workflowId!==workflowId&&old.value.status!=='PAUSED')return false;return store.writeRecord('auto-batch',id,{...old.value,workflowId,status:'RUNNING',error:undefined},old.etag);}
export async function pauseBatch(store:R2VideoStore,id:string,workflowId:string,error:string){const old=await store.readRecord<BatchRun>('auto-batch',id);if(old?.value.workflowId===workflowId){await store.writeRecord('auto-batch',id,{...old.value,status:'PAUSED',error:/^[A-Z_]+$/.test(error)?error:'AUTO_PROVIDER_FAILED'},old.etag);const item=old.value.items[old.value.cursor];if(item)await pauseAutomatic(store,item.autoRunId,workflowId,error);}}
export async function advanceBatch(store:R2VideoStore,id:string,workflowId:string){
 const saved=await store.readRecord<BatchRun>('auto-batch',id);if(!saved||saved.value.workflowId!==workflowId||saved.value.budget!=='RESERVED')return true;
 let batch=saved.value;const item=batch.items[batch.cursor];if(!item)return true;
 if(!item.prepared){
  const scene=await episodeScene(store,item.sceneId),ownRun=await store.readRecord<AutoRun>('auto-run',item.autoRunId);
  // A step may have saved the scene just before a crash. Resume that exact request.
  if(scene.state.videoJobId!==item.videoId){
   if(digest(JSON.stringify(scene.state))!==digest(JSON.stringify(item.original)))throw new WaveSpeedError('BATCH_SCENE_CHANGED',409);
   let imageSha256=item.original.imageSha256!,sourceJobId=item.original.sourceJobId,sourceAsset=item.original.sourceAsset,sourceTime=item.original.sourceTime;
   if(batch.cursor>0&&!(item.original.mode==='image'&&item.original.sceneBreak&&item.original.imageApproved&&item.original.imageSha256)){
    const prior=batch.items[batch.cursor-1],ctx=await postContext(store,prior.sceneId,'hu',batch.voices);
    if(ctx.job?.status!=='READY'||!ctx.job.finalAsset||ctx.job.fingerprint!==ctx.fingerprint||ctx.state.review==='needs-work')throw new WaveSpeedError('BATCH_FRAME_REQUIRED',409);
    const bytes=await extractFinalFrame(store,ctx.job.finalAsset);const image=await store.putImage(bytes);
    imageSha256=image.sha256;sourceJobId=ctx.state.videoJobId;sourceAsset=ctx.job.finalAsset;sourceTime=Math.max(0,ctx.job.duration-.001);
   }
   const old=await store.readRecord<SceneState>('episode-scene',item.sceneId);
   if((old?.value.revision??0)!==scene.state.revision)throw new WaveSpeedError('BATCH_SCENE_CHANGED',409);
   const state:SceneState={...scene.state,revision:scene.state.revision+1,updatedAt:new Date().toISOString(),videoJobId:item.videoId,videoRequest:{id:item.videoId,imageSha256,prompt:item.original.prompt,elements:item.elements,duration:10,sound:item.original.sound,maxCostUsd:1.68},imageSha256,imageApproved:false,sourceJobId,sourceAsset,sourceTime,videoHistory:[...new Set([...scene.state.videoHistory,...(scene.state.videoJobId?[scene.state.videoJobId]:[])])],imageHistory:[...new Set([...scene.state.imageHistory,...(scene.state.imageSha256?[scene.state.imageSha256]:[])])],review:'pending'};
   if(!await store.writeRecord('episode-scene',item.sceneId,state,old?.etag))throw new WaveSpeedError('BATCH_SCENE_CHANGED',409);
  }
  const c=await postContext(store,item.sceneId,'hu',batch.voices);
  if(!ownRun){const now=new Date().toISOString();const run:AutoRun={id:item.autoRunId,sceneId:item.sceneId,language:'hu',videoId:item.videoId,sourceHash:automaticSourceHash(c),voices:batch.voices,voiceRows:batch.voiceRows,createdAt:now,updatedAt:now,phase:'QUEUED',budget:'RESERVED',services:[],maxPostCostUsd:postCostCeiling(c.state.dialogue)};await store.writeRecord('auto-run',item.autoRunId,run);}
  await claimAutomatic(store,item.autoRunId,workflowId);
  // Individual panel and gallery keep showing progress while the queue runs.
  const h=digest(`automatic:${item.sceneId}:hu`),pId=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`,p=await store.readRecord('auto-scene',pId);
  await store.writeRecord('auto-scene',pId,{id:pId,runId:item.autoRunId},p?.etag);
  batch={...batch,items:batch.items.map((x,i)=>i===batch.cursor?{...x,prepared:true}:x)};
  if(!await store.writeRecord('auto-batch',id,batch,saved.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
  return false;
 }
 const priorRun=(await store.readRecord<AutoRun>('auto-run',item.autoRunId))?.value;if(priorRun?.phase==='PAUSED')await claimAutomatic(store,item.autoRunId,workflowId);
 const done=await advanceAutomatic(store,item.autoRunId,workflowId);if(!done)return false;
 const run=(await store.readRecord<AutoRun>('auto-run',item.autoRunId))?.value;
 if(run?.phase!=='READY'||!run.finalAsset)throw new WaveSpeedError('AUTO_PROVIDER_UNCERTAIN',409);
 const cursor=batch.cursor+1;
 batch={...batch,cursor,status:cursor===batch.items.length?'READY':'RUNNING',items:batch.items.map((x,i)=>i===batch.cursor?{...x,finalAsset:run.finalAsset}:x),updatedAt:new Date().toISOString()};
 if(!await store.writeRecord('auto-batch',id,batch,saved.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
 return batch.status==='READY';
}
