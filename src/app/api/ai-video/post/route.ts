import {NextRequest} from 'next/server';
import {z} from 'zod';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {postOverview,postAction} from '@/lib/ai-video/post';
import {readAutomatic} from '@/lib/ai-video/automatic';
import {WaveSpeedError} from '@/lib/providers/wavespeed';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{const u=await access(r),id=z.string().uuid().parse(r.nextUrl.searchParams.get('id')),language=z.enum(['hu','en']).parse(r.nextUrl.searchParams.get('language')??'hu');return json(await postOverview(new R2VideoStore(u.id),id,language));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true),store=new R2VideoStore(u.id),raw=await readJson(r),input=z.object({id:z.string().uuid(),language:z.enum(['hu','en'])}).parse(raw);const run=await readAutomatic(store,input.id,input.language);if(run&&!['READY','PAUSED'].includes(run.phase))throw new WaveSpeedError('AUTO_ACTIVE',409);return json(await postAction(raw,store));}catch(e){return apiError(e);}}
