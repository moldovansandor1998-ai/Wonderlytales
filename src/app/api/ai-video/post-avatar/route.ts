import {NextRequest} from 'next/server';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {avatarOverview,avatarAction} from '@/lib/ai-video/avatar-trial';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{const u=await access(r);return json(await avatarOverview(new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true);return json(await avatarAction(await readJson(r),new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
