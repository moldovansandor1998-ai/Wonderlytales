import {NextRequest} from 'next/server';
import {access,json,apiError} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {applyContinuityPlan} from '@/lib/ai-video/episode';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function POST(r:NextRequest){try{const u=await access(r,true);return json({results:await applyContinuityPlan(new R2VideoStore(u.id))});}catch(e){return apiError(e);}}
