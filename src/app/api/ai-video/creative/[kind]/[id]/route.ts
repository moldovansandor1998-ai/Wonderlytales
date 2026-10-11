import {NextRequest} from 'next/server';
import {access,apiError,json} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {pollCreative} from '@/lib/ai-video/creative';
import {WaveSpeedClient,WaveSpeedError} from '@/lib/providers/wavespeed';
export const maxDuration=120;
export async function POST(request:NextRequest,{params}:{params:{kind:string;id:string}}){try{const u=await access(request,true);if(params.kind!=='scene-image'&&params.kind!=='analysis')throw new WaveSpeedError('INVALID_INPUT',400);return json({job:await pollCreative(params.kind,params.id,new R2VideoStore(u.id),new WaveSpeedClient(process.env.WAVESPEED_API_KEY??''))});}catch(e){return apiError(e);}}
