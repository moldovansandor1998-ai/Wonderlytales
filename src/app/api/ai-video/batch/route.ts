import {NextRequest} from 'next/server';
import {z} from 'zod';
import {start} from 'workflow/api';
import {sceneBatch} from '@/workflows/scene-batch';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {startBatch,readBatch,publicBatch,updateBatch} from '@/lib/ai-video/batch';
import {WaveSpeedError} from '@/lib/providers/wavespeed';
export const dynamic='force-dynamic';export const maxDuration=120;
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),ids:z.array(z.string().uuid()).min(1).max(10),regenerate:z.boolean(),maxCostUsd:z.number().min(0).max(31.1)}).strict(),
 z.object({action:z.enum(['resume','stop']),id:z.string().uuid()}).strict(),
]);
export async function GET(req:NextRequest){try{const user=await access(req);return json({batch:publicBatch(await readBatch(new R2VideoStore(user.id)))});}catch(e){return apiError(e);}}
export async function POST(req:NextRequest){try{
 const user=await access(req,true),input=schema.parse(await readJson(req)),store=new R2VideoStore(user.id);
 let batch=await readBatch(store);
 if(input.action==='start')batch=await startBatch(store,input.ids,input.regenerate,input.maxCostUsd);
 else{
  if(!batch||batch.id!==input.id)throw new WaveSpeedError('SCENE_CHANGED',409);
  if(input.action==='stop'){await updateBatch(store,batch.id,{status:'STOPPED'});return json({batch:publicBatch(await readBatch(store))});}
  if(!['PAUSED','QUEUED'].includes(batch.status)||batch.budget!=='RESERVED')throw new WaveSpeedError('JOB_ACTIVE',409);
 }
 if(!batch)throw new WaveSpeedError('JOB_NOT_FOUND',404);
 await start(sceneBatch,[user.id,batch.id]);
 return json({batch:publicBatch(await readBatch(store))});
}catch(e){return apiError(e);}}
