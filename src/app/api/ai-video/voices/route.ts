import { NextRequest } from 'next/server';
import { z } from 'zod';
import { access,apiError,json,readJson } from '@/lib/ai-video/http';
import { castOverview,assignCharacterVoice } from '@/lib/ai-video/voices';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:NextRequest) {
  try {await access(request);return json(await castOverview());}catch(e){return apiError(e);}
}
export async function POST(request:NextRequest) {
  try {
    await access(request,true);
    const input=z.object({characterId:z.string().uuid(),voiceId:z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),expectedRowId:z.string().uuid().nullable()}).strict().parse(await readJson(request));
    await assignCharacterVoice(input.characterId,input.voiceId,input.expectedRowId);
    return json(await castOverview());
  }catch(e){return apiError(e);}
}
