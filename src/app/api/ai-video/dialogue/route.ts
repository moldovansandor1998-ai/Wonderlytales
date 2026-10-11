import { NextRequest } from 'next/server';
import { access,apiError,json,readJson } from '@/lib/ai-video/http';
import { recordCharacterDialogue } from '@/lib/ai-video/dialogue';
import { R2VideoStore } from '@/lib/ai-video/storage';
export const maxDuration=120;
export async function POST(request:NextRequest) {
  try {const user=await access(request,true);return json({recording:await recordCharacterDialogue(await readJson(request),new R2VideoStore(user.id))});}
  catch(e){return apiError(e);}
}
