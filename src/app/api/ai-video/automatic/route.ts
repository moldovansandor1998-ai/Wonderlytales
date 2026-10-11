import {NextRequest} from 'next/server';
import {z} from 'zod';
import {start} from 'workflow/api';
import {finishedVideo} from '@/workflows/finished-video';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {authorizeAutomatic,readAutomatic,publicAutomatic,checkAutomaticVoices,automaticSourceHash} from '@/lib/ai-video/automatic';
import {readBatch} from '@/lib/ai-video/batch';
import {digest} from '@/lib/ai-video/storage';
import {episodeAction,episodeScene} from '@/lib/ai-video/episode';
import {postOverview} from '@/lib/ai-video/post';
import {WaveSpeedError} from '@/lib/providers/wavespeed';
export const dynamic='force-dynamic';
export const maxDuration=120;
const selection=z.object({id:z.string().uuid(),language:z.enum(['hu','en']).default('hu')});
const inputSchema=selection.extend({action:z.enum(['generate','finish','resume']),revision:z.number().int().nonnegative().optional(),maxMotionCostUsd:z.number().min(0).max(1.68).optional(),maxPostCostUsd:z.number().min(0).max(1.43)}).strict();
export async function GET(request:NextRequest){try{const user=await access(request),{id,language}=selection.parse(Object.fromEntries(request.nextUrl.searchParams)),store=new R2VideoStore(user.id);return json({automatic:publicAutomatic(await readAutomatic(store,id,language)),post:await postOverview(store,id,language)});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){try{
 const user=await access(request,true),input=inputSchema.parse(await readJson(request)),store=new R2VideoStore(user.id);
 const ctx=await checkAutomaticVoices(store,input.id,input.language),batch=await readBatch(store);if(batch&&['QUEUED','RUNNING'].includes(batch.status)&&batch.items.some(i=>i.sceneId===input.id))throw new WaveSpeedError('BATCH_ACTIVE',409);
 if(input.action==='generate'){
  if(input.language!=='hu'||input.maxMotionCostUsd===undefined)throw new WaveSpeedError('INVALID_INPUT',400);
  await episodeAction({id:input.id,action:'video',revision:input.revision,data:{maxCostUsd:input.maxMotionCostUsd}},store,{deferVideo:true});
 }else{
  const scene=await episodeScene(store,input.id);if(!scene.video&&input.action!=='resume')throw new WaveSpeedError('VIDEO_REQUIRED',409);
 }
 const previous=input.action==='resume'?await readAutomatic(store,input.id,input.language):null;
 const run=previous?.budget==='RESERVED'&&previous.sourceHash===automaticSourceHash(ctx)&&(!previous.mixHash||previous.mixHash===digest(JSON.stringify(ctx.variant.mix)))?previous:await authorizeAutomatic(store,input.id,input.language,input.maxPostCostUsd);
 // Extra HTTP attempts may enqueue another run, but the R2 worker claim ensures
 // only one orchestration executes. Provider claims independently prevent charges.
 if(!run.workflowId||run.phase==='PAUSED')await start(finishedVideo,[user.id,run.id]);
 return json({scene:await episodeScene(store,input.id),automatic:publicAutomatic(run)});
}catch(e){return apiError(e);}}
