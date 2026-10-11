import {NextRequest} from 'next/server';
import {z} from 'zod';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {postOverview,postAction} from '@/lib/ai-video/post';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{const u=await access(r),id=z.string().uuid().parse(r.nextUrl.searchParams.get('id')),language=z.enum(['hu','en']).parse(r.nextUrl.searchParams.get('language')??'hu');return json(await postOverview(new R2VideoStore(u.id),id,language));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true);return json(await postAction(await readJson(r),new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
