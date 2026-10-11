import {NextRequest} from 'next/server';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {startSceneImage} from '@/lib/ai-video/creative';
import {WaveSpeedClient} from '@/lib/providers/wavespeed';
import type {CreativeJob} from '@/lib/ai-video/creative-shared';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:NextRequest){try{const u=await access(request),s=new R2VideoStore(u.id);const [images,analyses]=await Promise.all([s.listRecords<CreativeJob>('scene-image'),s.listRecords<CreativeJob>('analysis')]);return json({images,analyses});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){try{const u=await access(request,true);return json({job:await startSceneImage(await readJson(request),new R2VideoStore(u.id),new WaveSpeedClient(process.env.WAVESPEED_API_KEY??''))});}catch(e){return apiError(e);}}
