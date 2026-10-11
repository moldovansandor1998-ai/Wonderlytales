import {NextRequest} from 'next/server';
import {z} from 'zod';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {episodeMaster} from '@/lib/ai-video/episode-master';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{const u=await access(r),lang=z.enum(['hu','en']).parse(r.nextUrl.searchParams.get('language')??'hu');return json(await episodeMaster(new R2VideoStore(u.id),lang));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true),data=z.object({language:z.enum(['hu','en'])}).strict().parse(await readJson(r));return json(await episodeMaster(new R2VideoStore(u.id),data.language,true));}catch(e){return apiError(e);}}
