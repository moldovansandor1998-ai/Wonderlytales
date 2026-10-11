import {NextRequest} from 'next/server';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {voiceDesignOverview,designVoice} from '@/lib/ai-video/voice-design';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{const u=await access(r);return json(await voiceDesignOverview(new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{const u=await access(r,true);return json(await designVoice(await readJson(r),new R2VideoStore(u.id)));}catch(e){return apiError(e);}}
