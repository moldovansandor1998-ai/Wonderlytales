import {NextRequest} from 'next/server';
import {z} from 'zod';
import {start} from 'workflow/api';
import {sceneBatch} from '@/workflows/scene-batch';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {authorizeBatch,publicBatch,readBatch} from '@/lib/ai-video/batch';
import {WaveSpeedError} from '@/lib/providers/wavespeed';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:NextRequest){try{const user=await access(request);return json({batch:publicBatch(await readBatch(new R2VideoStore(user.id)))});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){try{
 const user=await access(request,true),store=new R2VideoStore(user.id);
 const input=z.object({action:z.enum(['start','resume']),id:z.string().uuid(),sceneIds:z.array(z.string().uuid()).min(1).max(10).optional(),maxCostUsd:z.number().min(0).max(31.1).optional()}).strict().parse(await readJson(request));
 const run=input.action==='start'?await authorizeBatch(store,input.sceneIds??[],input.id,input.maxCostUsd??0):await readBatch(store);
 if(!run||run.id!==input.id||run.budget!=='RESERVED')throw new WaveSpeedError('INVALID_INPUT',400);
 if(!run.workflowId||run.status==='PAUSED')await start(sceneBatch,[user.id,run.id]);
 return json({batch:publicBatch(run)});
}catch(e){return apiError(e);}}
