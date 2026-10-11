import {NextRequest} from 'next/server';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {references,saveReference} from '@/lib/ai-video/creative';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(request:NextRequest){try{const u=await access(request);return json({characters:await references(new R2VideoStore(u.id))});}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){try{const u=await access(request,true);return json({reference:await saveReference(new R2VideoStore(u.id),await readJson(request))});}catch(e){return apiError(e);}}
