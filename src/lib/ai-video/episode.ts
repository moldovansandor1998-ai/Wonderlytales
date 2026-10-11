import {requirePreviousApproval,fingerprint,postContext} from './post-core';
import type {PostScene,PostJob} from './post-shared';
import {randomUUID} from 'crypto';
import {z} from 'zod';
import {R2VideoStore} from './storage';
import {WaveSpeedClient,WaveSpeedError} from '../providers/wavespeed';
import {WaveSpeedVideoService} from './service';
import {startSceneImage,pollCreative,references} from './creative';
import {readCast,characterVoice} from './voices';
import {recordCharacterDialogue,type DialogueRecording} from './dialogue';
import {EPISODE_SCENES,EPISODE_TITLE,defaultSceneState} from './episode-data';
import {CAST,type CastKey,type SceneState,type EpisodeScene,type EpisodeCast} from './episode-shared';
import type {CreativeJob} from './creative-shared';
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const castKey=z.enum(['felix','mira','nera','tilda','oszkar']);
const line=z.object({character:castKey,text:z.string().trim().min(1).max(250),offset:z.number().min(0).max(9.5),delivery:z.enum(['visible','offscreen'])}).strict();
export const editSchema=z.object({mode:z.enum(['image','last-frame']),imagePrompt:z.string().trim().min(10).max(2000),prompt:z.string().trim().min(10).max(2200),characters:z.array(castKey).max(5).refine(a=>new Set(a).size===a.length),dialogue:z.array(line).max(3),note:z.string().max(2000),review:z.enum(['pending','keep','trim','needs-work']),trimStart:z.number().min(0).max(9.9),trimEnd:z.number().min(.1).max(10),sound:z.boolean()}).strict().refine(x=>x.trimEnd>x.trimStart,{message:'Invalid trim'});
export const commandSchema=z.object({id:z.string().uuid(),action:z.enum(['save','image','image-poll','approve-image','restore-image','frame','quote','video','video-poll','new-video','dialogue','attach-video']),revision:z.number().int().nonnegative().optional(),data:z.unknown().optional()}).strict();
export function definition(id:string){const d=EPISODE_SCENES.find(s=>s.id===id);if(!d)throw new WaveSpeedError('SCENE_NOT_FOUND',404);return d;}
export const recordingKey=(index:number)=>String(index);
async function stateOf(store:R2VideoStore,id:string){const d=definition(id),r=await store.readRecord<SceneState>('episode-scene',id);return {state:r?.value??defaultSceneState(d),etag:r?.etag};}
async function change(store:R2VideoStore,id:string,revision:number|undefined,fn:(s:SceneState)=>SceneState){
 const old=await stateOf(store,id);
 if(revision!==undefined&&old.state.revision!==revision)throw new WaveSpeedError('SCENE_CHANGED',409);
 const state={...fn(old.state),id,revision:old.state.revision+1,updatedAt:new Date().toISOString()};
 if(!await store.writeRecord('episode-scene',id,state,old.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
 return state;
}
async function archive(store:R2VideoStore,id:string){
 const old=await store.read(id);if(!old||old.job.status!=='COMPLETED'||old.job.archived)return;
 await store.archiveVideo(old.job);
 const current=await store.read(id);if(current)await store.save({...current.job,archived:true},current.etag);
}
export async function episodeScene(store:R2VideoStore,id:string):Promise<EpisodeScene>{
 const d=definition(id),{state}=await stateOf(store,id);
 const [video,imageJob,analysis,recordings]=await Promise.all([
 state.videoJobId?store.read(state.videoJobId):null,
 state.imageJobId?store.readRecord<CreativeJob>('scene-image',state.imageJobId):null,
 state.videoJobId?store.readRecord<CreativeJob>('analysis',state.videoJobId):null,
 Promise.all(Object.entries(state.recordings).map(async([k,v])=>[k,await store.readDialogue<DialogueRecording>(v)] as const))]);
 return {definition:d,state,video:video?.job??null,imageJob:imageJob?.value??null,analysis:analysis?.value??null,recordings:Object.fromEntries(recordings.filter(([,v])=>!!v)) as Record<string,DialogueRecording>};
}
export async function episodeOverview(store:R2VideoStore){
 const [{characters,voices},refs,scenes]=await Promise.all([readCast(),references(store),Promise.all(EPISODE_SCENES.map(s=>episodeScene(store,s.id)))]);
 const cast=Object.fromEntries(Object.entries(CAST).map(([key,c])=>{
 const character=characters.find(x=>x.id===c.id);
 return [key,{id:c.id,name:c.name,sha256:refs.find(x=>x.id===c.id)?.reference?.sha256??null,voiceId:character?characterVoice(character,voices)?.voice_id??null:null}];})) as EpisodeCast;
 const posts=await store.listRecords<PostScene>('post-scene');
 const voiceMap=Object.fromEntries(Object.entries(cast).map(([k,v])=>[k,v.voiceId])) as Record<CastKey,string|null>;
 const decorated=await Promise.all(scenes.map(async scene=>{
  const post=posts.find(p=>p.id===scene.state.id),summary:NonNullable<EpisodeScene['post']>={};
  for(const language of ['hu','en'] as const){const v=post?.variants[language];if(!v)continue;const job=v.jobId?(await store.readRecord<PostJob>('post-job',v.jobId))?.value:null;const hash=fingerprint(scene.state,v,language,voiceMap);summary[language]={approved:!!job?.finalAsset&&job.status==='READY'&&hash===job.fingerprint&&v.approvedFingerprint===hash,finalAsset:job?.finalAsset,status:job?.status};}
  return {...scene,post:summary};
 }));
 return {title:EPISODE_TITLE,duration:600,scenes:decorated,cast};
}
export async function episodeAction(raw:unknown,store:R2VideoStore){
 const c=commandSchema.parse(raw),d=definition(c.id);
 let {state}=await stateOf(store,c.id);
 const api=()=>new WaveSpeedClient(process.env.WAVESPEED_API_KEY??'');
 const service=()=>new WaveSpeedVideoService(api(),store,s=>store.imageUrl(s));
 if(c.action==='save'){
  const edit=editSchema.parse(c.data);
  state=await change(store,c.id,c.revision,s=>({...s,...edit,imageApproved:edit.mode===s.mode&&edit.imagePrompt===s.imagePrompt&&JSON.stringify(edit.characters)===JSON.stringify(s.characters)?s.imageApproved:false,...(edit.mode!==s.mode?{imageSha256:undefined,imageJobId:undefined,imageRequest:undefined,sourceJobId:undefined,sourceTime:undefined,imageHistory:s.imageSha256?[...new Set([...s.imageHistory,s.imageSha256])]:s.imageHistory}:{}),recordings:Object.fromEntries(Object.entries(s.recordings).filter(([i])=>JSON.stringify(edit.dialogue[Number(i)])===JSON.stringify(s.dialogue[Number(i)])))}));
 }else if(c.action==='image'){
  if(d.kind==='intro')throw new WaveSpeedError('EXISTING_INTRO',409);
  const data=z.object({force:z.boolean().optional()}).strict().parse(c.data??{});
  if(state.mode!=='image')throw new WaveSpeedError('CHOOSE_FRAME',409);
  if(!state.imageSha256||data.force){
   await requirePreviousApproval(store,d.order);
   if(data.force&&state.imageJobId){const old=await store.readRecord<CreativeJob>('scene-image',state.imageJobId);if(old&&['SUBMITTING','PROCESSING','UNCERTAIN'].includes(old.value.status))throw new WaveSpeedError('JOB_ACTIVE',409);}
   if(!state.imageRequest||data.force){
    const previous=EPISODE_SCENES[d.order-1];
    const prior=previous&&previous.location===d.location?(await stateOf(store,previous.id)).state:null;
    const environment=state.imageSha256??prior?.imageSha256;
    const req={id:randomUUID(),prompt:state.imagePrompt,characterIds:state.characters.map(k=>CAST[k].id),...(environment?{referenceSha256:environment}:{})};
    state=await change(store,c.id,c.revision,s=>({...s,imageJobId:req.id,imageRequest:req,imageApproved:false,...(s.imageSha256?{imageHistory:[...new Set([...s.imageHistory,s.imageSha256])]}:{}),imageSha256:undefined}));
   }
   await startSceneImage(state.imageRequest,store,api());
  }
 }else if(c.action==='image-poll'){
  if(!state.imageJobId)throw new WaveSpeedError('JOB_NOT_FOUND',404);
  const imageJob=await pollCreative('scene-image',state.imageJobId,store,api());
  if(imageJob.image&&imageJob.image.sha256!==state.imageSha256)await change(store,c.id,undefined,s=>s.imageJobId===imageJob.id?{...s,imageSha256:imageJob.image!.sha256,imageApproved:false}:s);
 }else if(c.action==='restore-image'){
  const data=z.object({sha256:sha}).strict().parse(c.data);
  if(!state.imageHistory.includes(data.sha256))throw new WaveSpeedError('INVALID_INPUT',400);
  if(state.imageJobId){const old=await store.readRecord<CreativeJob>('scene-image',state.imageJobId);if(old&&['SUBMITTING','PROCESSING','UNCERTAIN'].includes(old.value.status))throw new WaveSpeedError('JOB_ACTIVE',409);}
  await store.imageUrl(data.sha256);
  await change(store,c.id,c.revision,s=>({...s,mode:'image',imageSha256:data.sha256,imageApproved:false,imageJobId:undefined,imageRequest:undefined,sourceJobId:undefined,sourceTime:undefined,imageHistory:[...new Set([...s.imageHistory,...(s.imageSha256?[s.imageSha256]:[])])]}));
 }else if(c.action==='approve-image'){
  if(!state.imageSha256)throw new WaveSpeedError('IMAGE_REQUIRED',400);
  await store.imageUrl(state.imageSha256);
  await change(store,c.id,c.revision,s=>({...s,imageApproved:true}));
 }else if(c.action==='frame'){
  const data=z.object({sha256:sha,sourceJobId:z.string().uuid(),sourceAsset:sha.optional(),sourceTime:z.number().finite().min(0).max(20)}).strict().parse(c.data);
  const previous=EPISODE_SCENES[d.order-1];
  if(!previous)throw new WaveSpeedError('PREVIOUS_VIDEO_REQUIRED',409);
  await requirePreviousApproval(store,d.order);
  const finalized=await postContext(store,previous.id,'hu');
  if(data.sourceAsset!==finalized.job?.finalAsset)throw new WaveSpeedError('PREVIOUS_VIDEO_CHANGED',409);
  const prior=await stateOf(store,previous.id);
  if(prior.state.videoJobId!==data.sourceJobId)throw new WaveSpeedError('PREVIOUS_VIDEO_CHANGED',409);
  const source=await store.read(data.sourceJobId);
  if(source?.job.status!=='COMPLETED'||data.sourceTime>source.job.duration+.2)throw new WaveSpeedError('PREVIOUS_VIDEO_REQUIRED',409);
  await store.imageUrl(data.sha256);
  await change(store,c.id,c.revision,s=>({...s,mode:'last-frame',imageSha256:data.sha256,imageApproved:false,sourceJobId:data.sourceJobId,sourceTime:data.sourceTime,imageJobId:undefined,imageRequest:undefined,imageHistory:s.imageSha256?[...new Set([...s.imageHistory,s.imageSha256])]:s.imageHistory}));
 }else if(c.action==='quote'||c.action==='video'){
  if(d.kind==='intro')throw new WaveSpeedError('EXISTING_INTRO',409);
  if(!state.imageSha256||!state.imageApproved)throw new WaveSpeedError('APPROVE_IMAGE',409);
  await requirePreviousApproval(store,d.order);
  const data=z.object({maxCostUsd:z.number().min(0).max(1.68).optional()}).strict().parse(c.data??{});
  const input={id:randomUUID(),imageSha256:state.imageSha256,prompt:state.prompt,duration:10 as const,sound:state.sound,maxCostUsd:data.maxCostUsd??1.68};
  if(c.action==='quote')return {scene:await episodeScene(store,c.id),quote:await service().quote(input)};
  if(!state.videoRequest&&!state.videoJobId)state=await change(store,c.id,c.revision,s=>({...s,videoJobId:input.id,videoRequest:input,review:'pending'}));
  if(!state.videoRequest)throw new WaveSpeedError('VIDEO_EXISTS',409);
  await service().submit(state.videoRequest);await archive(store,state.videoRequest.id);
 }else if(c.action==='video-poll'){
  if(!state.videoJobId)throw new WaveSpeedError('JOB_NOT_FOUND',404);
  await service().poll(state.videoJobId);await archive(store,state.videoJobId);
 }else if(c.action==='new-video'){
  if(d.kind==='intro')throw new WaveSpeedError('EXISTING_INTRO',409);
  if(state.videoJobId){const old=await store.read(state.videoJobId);if(!old||['SUBMITTING','RUNNING','QUEUED','SUBMISSION_UNCERTAIN'].includes(old.job.status))throw new WaveSpeedError('JOB_ACTIVE',409);}
  await change(store,c.id,c.revision,s=>({...s,videoHistory:s.videoJobId?[...new Set([...s.videoHistory,s.videoJobId])]:s.videoHistory,videoJobId:undefined,videoRequest:undefined,review:'pending'}));
 }else if(c.action==='attach-video'){
  const data=z.object({jobId:z.string().uuid()}).strict().parse(c.data);
  const old=await store.read(data.jobId);if(old?.job.status!=='COMPLETED')throw new WaveSpeedError('JOB_NOT_FOUND',404);
  await change(store,c.id,c.revision,s=>({...s,videoJobId:data.jobId,videoRequest:undefined,videoHistory:[...new Set([...s.videoHistory,...(s.videoJobId?[s.videoJobId]:[])])],review:'pending'}));
 }else if(c.action==='dialogue'){
  const data=z.object({index:z.number().int().min(0).max(2)}).strict().parse(c.data),line=state.dialogue[data.index];
  if(!line)throw new WaveSpeedError('INVALID_INPUT',400);
  const {characters,voices}=await readCast(),character=characters.find(x=>x.id===CAST[line.character].id),voice=character&&characterVoice(character,voices);
  if(!voice)throw new WaveSpeedError('CHARACTER_VOICE_MISSING',409);
  const rec=await recordCharacterDialogue({characterId:character!.id,expectedVoiceId:voice.voice_id,text:line.text},store);
  await change(store,c.id,undefined,s=>JSON.stringify(s.dialogue[data.index])===JSON.stringify(line)?{...s,recordings:{...s.recordings,[String(data.index)]:rec.id}}:s);
 }
 return {scene:await episodeScene(store,c.id)};
}
