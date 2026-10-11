import {NextRequest} from 'next/server';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {elementOverview,elementAction} from '@/lib/ai-video/elements';
export const dynamic='force-dynamic';export const maxDuration=60;
export async function GET(r:NextRequest){try{const u=await access(r);return json(await elementOverview(new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true);return json(await elementAction(await readJson(r),new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
