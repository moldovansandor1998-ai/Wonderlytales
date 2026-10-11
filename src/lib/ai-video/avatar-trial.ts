import {z} from 'zod';
import {R2VideoStore,digest} from './storage';
import {postContext,validateRecordings} from './post-core';
import {finalFrame,speechTrack,storeFile,tempMedia} from './post-media';
import {downloadProviderMedia} from './media';
import {WaveSpeedClient,WaveSpeedError} from '../providers/wavespeed';
import {reserveProductionBudget} from '../budget';
import {VIDEO_NO_TEXT_RULE} from './shared';

// One owner-scoped, immutable trial. No reset/retry/new-job action is exposed.
export const AVATAR_TRIAL_ID='a1700001-2026-4011-8010-000000000503';
export const AVATAR_MODEL='kwaivgi/kling-v2-ai-avatar-pro' as const;
const SOURCE='05d9c2607730a6383cf88d76a254cf17c0e262570249036d14398a63ef9ac194';
const SCENE='a1700001-2026-4011-8010-000000000003';
const PROMPT='Continue this exact stylized 3D animated film frame as a single continuous shot. Felix, the orange fox in the foreground, briefly catches his breath and speaks the supplied Hungarian dialogue with clear expressive mouth articulation synchronized precisely to the audio. Preserve his muzzle, eyes, fur, blue jacket, backpack and proportions. Keep the original street, buildings, pavement, car, daylight, framing and aspect ratio. Subtle natural facial and head motion; steady camera. Only Felix speaks. No new characters, no police rabbit, no scene change, no cuts, no text.';
export type AvatarTrial={id:string;status:'PREPARED'|'SUBMITTING'|'PROCESSING'|'UNCERTAIN'|'READY'|'FAILED';image:string;audio:string;recording:string;source:string;createdAt:string;price?:number;taskId?:string;finalAsset?:string;error?:string};
const command=z.object({action:z.enum(['prepare','quote','start','poll']),maxCostUsd:z.number().finite().min(0).max(.56).optional()}).strict();
export async function avatarOverview(store:R2VideoStore){return {job:(await store.readRecord<AvatarTrial>('avatar-trial',AVATAR_TRIAL_ID))?.value??null};}
export async function avatarAction(raw:unknown,store:R2VideoStore){
 const input=command.parse(raw);
 let saved=await store.readRecord<AvatarTrial>('avatar-trial',AVATAR_TRIAL_ID);
 if(input.action==='prepare'){
  if(saved)return {job:saved.value};
  const ctx=await postContext(store,SCENE,'hu');validateRecordings(ctx);
  if(ctx.lines.length!==1||ctx.lines[0].character!=='felix'||ctx.lines[0].delivery!=='visible'||ctx.lines[0].text!=='Hűha! Ez aztán közel volt! Mi folyik itt ma?')throw new WaveSpeedError('TRIAL_DIALOGUE_CHANGED',409);
  const rec=ctx.recordings['0'];if(!rec.duration||rec.duration>4.4)throw new WaveSpeedError('DIALOGUE_OUTSIDE_TRIM',409);
  const image=await finalFrame(store,SOURCE);
  const audio=await tempMedia(async dir=>storeFile(store,await speechTrack(dir,store,[{...ctx.lines[0],offset:.5}],{'0':rec.id},5,0),'wav'));
  const job:AvatarTrial={id:AVATAR_TRIAL_ID,status:'PREPARED',image,audio,recording:rec.id,source:SOURCE,createdAt:new Date().toISOString()};
  await store.writeRecord('avatar-trial',AVATAR_TRIAL_ID,job);
  return avatarOverview(store);
 }
 if(!saved)throw new WaveSpeedError('PREPARE_REQUIRED',409);
 let job=saved.value;
 // CAS protects against concurrent clicks, pollers and stale responses.
 async function save(next:AvatarTrial){
  if(!await store.writeRecord('avatar-trial',AVATAR_TRIAL_ID,next,saved!.etag))throw new WaveSpeedError('JOB_ACTIVE',409);
  saved=await store.readRecord<AvatarTrial>('avatar-trial',AVATAR_TRIAL_ID);job=next;
 }
 if(input.action==='start'||input.action==='quote'){
  if(job.status!=='PREPARED')return {job};
  const provider=new WaveSpeedClient(process.env.WAVESPEED_API_KEY??'');
  const payload={image:await store.imageUrl(job.image),audio:await store.assetUrl(job.audio,'wav'),prompt:`${PROMPT} ${VIDEO_NO_TEXT_RULE}`};
  const [price,balance]=await Promise.all([provider.creativePrice(AVATAR_MODEL,payload),provider.balance()]);
  if(!Number.isFinite(price)||price<0||price>.560001)throw new WaveSpeedError('TRIAL_PRICE_TOO_HIGH',409);
  if(input.action==='quote')return {job,quote:{price,balance}};
  if(input.maxCostUsd===undefined||price>input.maxCostUsd+.000001)throw new WaveSpeedError('PRICE_CHANGED',409);
  if(balance<price)throw new WaveSpeedError('WAVESPEED_BALANCE_LOW',409);
  await save({...job,status:'SUBMITTING',price});
  try{await reserveProductionBudget('wavespeed_lipsync');}
  catch{await save({...job,status:'FAILED',error:'BUDGET_BLOCKED'});throw new WaveSpeedError('BUDGET_BLOCKED',409);}
  try{
   const task=await provider.creativeSubmit(AVATAR_MODEL,payload);
   await save({...job,status:'PROCESSING',taskId:task.id});
  }catch{
   // A submission timeout might still have charged. Never submit this trial again.
   const latest=await store.readRecord<AvatarTrial>('avatar-trial',AVATAR_TRIAL_ID);
   if(latest?.value.taskId)return {job:latest.value};
   saved=latest;await save({...job,status:'UNCERTAIN',error:'SUBMISSION_UNCERTAIN'});
  }
 }else if(input.action==='poll'&&job.status==='PROCESSING'&&job.taskId){
  const task=await new WaveSpeedClient(process.env.WAVESPEED_API_KEY??'').creativeResult(job.taskId);
  if(['failed','cancelled','timeout','deleted'].includes(task.status))await save({...job,status:'FAILED',error:'AVATAR_PROVIDER_FAILED'});
  else if(task.status==='completed'){
   const url=task.outputs?.[0];if(typeof url!=='string')throw new WaveSpeedError('MEDIA_UNAVAILABLE');
   const bytes=await downloadProviderMedia(url,100*1024*1024),sha=digest(bytes);
   await store.putAsset(sha,'mp4',bytes);await save({...job,status:'READY',finalAsset:sha});
  }
 }
 return {job};
}
