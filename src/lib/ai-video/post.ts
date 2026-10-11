import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {R2VideoStore,digest} from './storage';
import {CAST,type SceneLine,type CastKey} from './episode-shared';
import {postContext,sourceHash,validateRecordings} from './post-core';
import {newVersion,type Language,type LanguageVersion,type PostJob} from './post-shared';
import {ENGLISH_LINES} from './episode-english';
import {recordCharacterDialogue,type DialogueExecution} from './dialogue';
import {WaveSpeedClient,WaveSpeedError} from '../providers/wavespeed';
import {reserveProductionBudget} from '../budget';
import {tempMedia,downloadOwned,normalizeVideo,speechTrack,mixVideo,storeFile} from './post-media';
import {downloadProviderMedia} from './media';
const cast=z.enum(['felix','mira','nera','tilda','oszkar']);
const linesSchema=z.array(z.object({character:cast,text:z.string().trim().min(1).max(250),offset:z.number().min(0).max(9.5),delivery:z.enum(['visible','offscreen'])}).strict()).max(3);
const mixSchema=z.object({background:z.number().min(0).max(1),voice:z.number().min(.2).max(2),leftSpeaker:cast.nullable(),layoutConfirmed:z.boolean(),sourceSpeech:z.enum(['none','mute','loop-intro'])}).strict();
const command=z.object({id:z.string().uuid(),language:z.enum(['hu','en']),action:z.enum(['save','english','record','prepare','quote','start','poll','approve','revoke']),revision:z.number().int().min(0).optional(),index:z.number().int().min(0).max(2).optional(),data:z.unknown().optional()}).strict();
const api=()=>new WaveSpeedClient(process.env.WAVESPEED_API_KEY??'');
export type PostExecution={voices?:Record<CastKey,string|null>;dialogue?:DialogueExecution;reserveLipsync?:()=>Promise<void>};
export async function postOverview(store:R2VideoStore,id:string,lang:Language,execution:PostExecution={}){const c=await postContext(store,id,lang,execution.voices);return {id,language:lang,revision:c.post.revision,variant:c.variant,lines:c.lines,recordings:c.recordings,job:c.job,approved:c.approved,translationCurrent:c.translationCurrent,current:c.job?.fingerprint===c.fingerprint};}
export async function postAction(raw:unknown,store:R2VideoStore,execution:PostExecution={}){
 const input=command.parse(raw);let ctx=await postContext(store,input.id,input.language,execution.voices);
 if(input.revision!==undefined&&input.revision!==ctx.post.revision)throw new WaveSpeedError('SCENE_CHANGED',409);
 async function setVariant(v:LanguageVersion){const next={...ctx.post,revision:ctx.post.revision+1,variants:{...ctx.post.variants,[input.language]:v}};if(!await store.writeRecord('post-scene',input.id,next,ctx.etag))throw new WaveSpeedError('SCENE_CHANGED',409);ctx=await postContext(store,input.id,input.language,execution.voices);}
 async function saveJob(j:PostJob){const old=await store.readRecord<PostJob>('post-job',j.id);if(!await store.writeRecord('post-job',j.id,j,old?.etag))throw new WaveSpeedError('SCENE_CHANGED',409);return j;}
 if(input.action==='english'){
  if(input.language!=='en')throw new WaveSpeedError('INVALID_INPUT',400);
  if(!ctx.variant.dialogue){
   const seed=ENGLISH_LINES[ctx.definition.order]??[];
   let lines:SceneLine[]=ctx.state.dialogue.map((l,i)=>({...l,text:ctx.definition.dialogue[i]?.text===l.text?seed[i]??'': ''}));
   if(ctx.definition.kind==='intro')lines=[{character:'felix',text:'Subscribe to the channel!',offset:5.5,delivery:'visible'}];
   // Keep changed source lines as editable empty drafts; approval requires all text.

   await setVariant({...ctx.variant,dialogue:lines,sourceHash:sourceHash(ctx.state.dialogue),translationApproved:false,mix:{...ctx.variant.mix,...(ctx.definition.kind==='intro'?{sourceSpeech:'loop-intro' as const}:{})}});
  }
 }else if(input.action==='save'){
  const data=z.object({mix:mixSchema,dialogue:linesSchema.optional(),translationApproved:z.boolean().optional()}).strict().parse(input.data);
  if(data.mix.sourceSpeech==='loop-intro'&&ctx.definition.kind!=='intro')throw new WaveSpeedError('INVALID_INPUT',400);
  if(input.language==='hu'&&data.dialogue)throw new WaveSpeedError('EDIT_SOURCE_DIALOGUE',400);
  await setVariant({...ctx.variant,mix:data.mix,...(data.dialogue?{dialogue:data.dialogue,sourceHash:sourceHash(ctx.state.dialogue)}:{}),translationApproved:data.translationApproved??ctx.variant.translationApproved,approvedFingerprint:undefined,approvedAt:undefined});
 }else if(input.action==='record'){
  if(input.language==='en'&&(!ctx.translationCurrent||!ctx.variant.translationApproved))throw new WaveSpeedError('APPROVE_TRANSLATION',409);
  const i=input.index??0,line=ctx.lines[i];if(!line)throw new WaveSpeedError('INVALID_INPUT',400);
  const designed=await store.readRecord<{status:string;newVoiceId?:string}>('voice-design',CAST[line.character].id);
  if(designed?.value.status!=='ACTIVE'||designed.value.newVoiceId!==ctx.voices[line.character])throw new WaveSpeedError('NEW_CHARACTER_VOICE_REQUIRED',409);
  const voice=ctx.voices[line.character];if(!voice)throw new WaveSpeedError('CHARACTER_VOICE_MISSING',409);
  const recording=await recordCharacterDialogue({characterId:CAST[line.character].id,expectedVoiceId:voice,text:line.text,language:input.language},store,execution.dialogue);
  await setVariant({...ctx.variant,recordings:{...ctx.variant.recordings,[String(i)]:recording.id},approvedFingerprint:undefined});
 }else if(input.action==='prepare'){
  if(input.language==='en'&&(!ctx.translationCurrent||!ctx.variant.translationApproved))throw new WaveSpeedError('APPROVE_TRANSLATION',409);
  const video=ctx.state.videoJobId?await store.read(ctx.state.videoJobId):null;
  if(video?.job.status!=='COMPLETED')throw new WaveSpeedError('VIDEO_REQUIRED',409);
  for(const k of new Set(ctx.lines.map(l=>l.character))){const designed=await store.readRecord<{status:string;newVoiceId?:string}>('voice-design',CAST[k].id);if(designed?.value.status!=='ACTIVE'||designed.value.newVoiceId!==ctx.voices[k])throw new WaveSpeedError('NEW_CHARACTER_VOICE_REQUIRED',409);}
  const visible=validateRecordings(ctx);
  if(ctx.job?.fingerprint===ctx.fingerprint&&ctx.job.status!=='PREPARING'&&!(ctx.job.status==='FAILED'&&!ctx.job.taskId))return postOverview(store,input.id,input.language,execution);
  let job:PostJob=ctx.job?.fingerprint===ctx.fingerprint?ctx.job:{id:randomUUID(),sceneId:input.id,language:input.language,fingerprint:ctx.fingerprint,status:'PREPARING',sourceVideoId:video.job.id,duration:ctx.state.trimEnd-ctx.state.trimStart,createdAt:new Date().toISOString()};
  if(ctx.job?.id!==job.id){await saveJob(job);await setVariant({...ctx.variant,jobId:job.id,history:[...new Set([...ctx.variant.history,...(ctx.variant.jobId?[ctx.variant.jobId]:[])])],approvedFingerprint:undefined});}
  // Media preparation is deterministic and free to retry. No paid request occurs here.
  try{await tempMedia(async dir=>{
   const original=join(dir,'original.mp4'),normalized=join(dir,'video.mp4');await downloadOwned(await store.videoUrl(video.job),original);
   await normalizeVideo(original,normalized,ctx.state.trimStart,ctx.state.trimEnd);
   const ids=Object.fromEntries(Object.entries(ctx.recordings).map(([i,r])=>[i,r.id]));
   const speech=await speechTrack(dir,store,ctx.lines,ids,job.duration,ctx.state.trimStart);
   job={...job,videoAsset:await storeFile(store,normalized,'mp4'),dialogueAsset:await storeFile(store,speech,'wav')};
   if(!visible.length){const out=join(dir,'final.mp4');await mixVideo(normalized,original,speech,out,ctx.variant.mix,ctx.state.trimStart,job.duration);job={...job,status:'READY',finalAsset:await storeFile(store,out,'mp4')};}
   else{
    const order=visible.length===2?[ctx.variant.mix.leftSpeaker!,visible.find(k=>k!==ctx.variant.mix.leftSpeaker)!]:visible;
    const speakerAssets=[];for(const k of order){const path=await speechTrack(dir,store,ctx.lines,ids,job.duration,ctx.state.trimStart,l=>l.character===k&&l.delivery==='visible');speakerAssets.push(await storeFile(store,path,'wav'));}
    job={...job,speakerAssets,model:visible.length===2?'wavespeed-ai/infinitetalk/video-to-video-multi':'wavespeed-ai/infinitetalk/video-to-video',prompt:`Preserve this original stylized 3D animated film exactly: same animal faces, muzzle shape, fur, clothing, body proportions, background architecture, movement and camera. ${order.map((k,i)=>`${i===0?'Left / primary':'Right'} speaker: ${CAST[k].name}, ${CAST[k].description}`).join('. ')}. Only these characters speak their assigned audio. Other characters remain silent. No cuts, no added gestures, no new objects or characters.`,status:'PREPARED'};
    // A new mix of the same performance reuses its completed lip-sync video.
    const oldJobs=await Promise.all(ctx.variant.history.map(id=>store.readRecord<PostJob>('post-job',id)));
    const reusable=oldJobs.find(x=>(x?.value.lipAsset||x?.value.outputUrl)&&x!.value.videoAsset===job.videoAsset&&JSON.stringify(x!.value.speakerAssets)===JSON.stringify(job.speakerAssets)&&x!.value.prompt===job.prompt);
    if(reusable)job={...job,outputUrl:reusable.value.outputUrl,lipAsset:reusable.value.lipAsset,taskId:reusable.value.taskId,status:'PROCESSING'};
   }
   await saveJob(job);
  });}catch(e){await saveJob({...job,status:'FAILED',error:e instanceof WaveSpeedError?e.code:'MIX_FAILED'});throw e;}
 }else if(['quote','start'].includes(input.action)){
  let job=ctx.job;if(!job||job.fingerprint!==ctx.fingerprint||job.status!=='PREPARED'||!job.model)throw new WaveSpeedError('PREPARE_REQUIRED',409);
  const payload=await lipsyncPayload(job,store),provider=api();
  const [price,balance]=await Promise.all([provider.creativePrice(job.model,payload),provider.balance()]);
  if(price>.66)throw new WaveSpeedError('LIPSYNC_PRICE_TOO_HIGH',409);
  if(input.action==='quote')return {...await postOverview(store,input.id,input.language,execution),quote:{price,balance}};
  const max=z.object({maxCostUsd:z.number().min(0).max(.66)}).strict().parse(input.data).maxCostUsd;
  if(price>max+.000001)throw new WaveSpeedError('PRICE_CHANGED',409);if(balance<price)throw new WaveSpeedError('WAVESPEED_BALANCE_LOW',409);
  const old=await store.readRecord<PostJob>('post-job',job.id);if(old?.value.status!=='PREPARED')throw new WaveSpeedError('JOB_ACTIVE',409);
  job={...job,status:'SUBMITTING',price};if(!await store.writeRecord('post-job',job.id,job,old.etag))throw new WaveSpeedError('JOB_ACTIVE',409);
  try{await (execution.reserveLipsync??(()=>reserveProductionBudget('wavespeed_lipsync')))();}catch{await saveJob({...job,status:'FAILED',error:'BUDGET_BLOCKED'});throw new WaveSpeedError('BUDGET_BLOCKED',409);}
  try{const task=await provider.creativeSubmit(job.model!,payload);job={...job,taskId:task.id,status:'PROCESSING'};await saveJob(job);}catch(e){const latest=(await store.readRecord<PostJob>('post-job',job.id))?.value;const taskId=latest?.taskId??job.taskId??(e instanceof WaveSpeedError?e.taskId:undefined);await saveJob({...job,taskId,status:taskId?'PROCESSING':'UNCERTAIN',error:taskId?undefined:'LIPSYNC_SUBMISSION_UNCERTAIN'});}
 }else if(input.action==='poll'){
  let job=ctx.job;if(!job)throw new WaveSpeedError('PREPARE_REQUIRED',409);
  if(job.status!=='PROCESSING')return postOverview(store,input.id,input.language,execution);
  if(!job.outputUrl&&!job.lipAsset){if(!job.taskId)throw new WaveSpeedError('JOB_ACTIVE',409);const task=await api().creativeResult(job.taskId);if(['failed','cancelled','timeout','deleted'].includes(task.status)){await saveJob({...job,status:'FAILED',error:'LIPSYNC_PROVIDER_FAILED'});return postOverview(store,input.id,input.language,execution);}if(task.status!=='completed')return postOverview(store,input.id,input.language,execution);const url=task.outputs?.[0];if(typeof url!=='string')throw new WaveSpeedError('MEDIA_UNAVAILABLE');job=await saveJob({...job,outputUrl:url});}
  const frozen=job;
  // Mix only against the unchanged source/settings. Changed edits require another preparation.
  if(job.fingerprint!==ctx.fingerprint)throw new WaveSpeedError('POST_CHANGED',409);
  await tempMedia(async dir=>{const lip=join(dir,'lip.mp4'),original=join(dir,'original.mp4'),speech=join(dir,'speech.wav'),out=join(dir,'final.mp4');await writeFile(lip,frozen.lipAsset?await store.assetBytes(frozen.lipAsset,'mp4'):await downloadProviderMedia(frozen.outputUrl!,100*1024*1024));const lipAsset=frozen.lipAsset??await storeFile(store,lip,'mp4');const source=await store.read(frozen.sourceVideoId);if(!source)throw new WaveSpeedError('VIDEO_REQUIRED',409);await downloadOwned(await store.videoUrl(source.job),original);await writeFile(speech,await store.assetBytes(frozen.dialogueAsset!,'wav'));await mixVideo(lip,original,speech,out,ctx.variant.mix,ctx.state.trimStart,frozen.duration);await saveJob({...frozen,lipAsset,status:'READY',finalAsset:await storeFile(store,out,'mp4')});});
 }else if(input.action==='approve'){
  if(ctx.state.review==='needs-work')throw new WaveSpeedError('VISUAL_REPAIR_REQUIRED',409);
  if(ctx.job?.status!=='READY'||!ctx.job.finalAsset||ctx.job.fingerprint!==ctx.fingerprint)throw new WaveSpeedError('FINAL_REVIEW_REQUIRED',409);
  if(input.language==='en'&&(!ctx.translationCurrent||!ctx.variant.translationApproved))throw new WaveSpeedError('APPROVE_TRANSLATION',409);
  await setVariant({...ctx.variant,approvedFingerprint:ctx.fingerprint,approvedAt:new Date().toISOString()});
 }else if(input.action==='revoke'){await setVariant({...ctx.variant,approvedFingerprint:undefined,approvedAt:undefined});}
 return postOverview(store,input.id,input.language,execution);
}
async function lipsyncPayload(job:PostJob,store:R2VideoStore){
 const common={video:await store.assetUrl(job.videoAsset!,'mp4'),resolution:'720p',prompt:job.prompt,seed:731};
 return job.speakerAssets?.length===2?{...common,left_audio:await store.assetUrl(job.speakerAssets[0],'wav'),right_audio:await store.assetUrl(job.speakerAssets[1],'wav'),order:'meanwhile'}:{...common,audio:await store.assetUrl(job.speakerAssets![0],'wav')};
}
