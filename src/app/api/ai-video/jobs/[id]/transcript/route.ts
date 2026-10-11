import { NextRequest } from 'next/server';
import { access,apiError,json } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
import { checkSpeech } from '@/lib/ai-video/transcript';
import { WaveSpeedClient } from '@/lib/providers/wavespeed';
export const maxDuration=120;
export async function POST(request: NextRequest,{params}:{params:{id:string}}) {
  try {
    const user=await access(request,true);
    return json({job:await checkSpeech(params.id,new R2VideoStore(user.id),new WaveSpeedClient(process.env.WAVESPEED_API_KEY??''))});
  } catch(e) {return apiError(e);}
}
