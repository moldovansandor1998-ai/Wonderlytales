import {NextRequest} from 'next/server';
import {z} from 'zod';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {startAnalysis} from '@/lib/ai-video/creative';
import {WaveSpeedClient,WaveSpeedError} from '@/lib/providers/wavespeed';
export const maxDuration=120;
export async function POST(request:NextRequest,{params}:{params:{id:string}}){try{const u=await access(request,true);return json({job:await startAnalysis(params.id,new R2VideoStore(u.id),new WaveSpeedClient(process.env.WAVESPEED_API_KEY??''))});}catch(e){return apiError(e);}}
export async function PATCH(request:NextRequest,{params}:{params:{id:string}}){try{
  const u=await access(request,true),s=new R2VideoStore(u.id),input=z.object({continuityNote:z.string().trim().max(2500),expectedNote:z.string().max(2500)}).strict().parse(await readJson(request)),saved=await s.read(params.id);
  if(!saved)throw new WaveSpeedError('JOB_NOT_FOUND',404);
  if((saved.job.continuityNote??'')!==input.expectedNote)throw new WaveSpeedError('NOTE_CHANGED',409);
  const job={...saved.job,continuityNote:input.continuityNote};if(!await s.save(job,saved.etag))throw new WaveSpeedError('NOTE_CHANGED',409);return json({job});
}catch(e){return apiError(e);}}
