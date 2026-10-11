import { NextRequest,NextResponse } from 'next/server';
import { access,apiError } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
import { WaveSpeedError } from '@/lib/providers/wavespeed';
import type { DialogueRecording } from '@/lib/ai-video/dialogue';
export async function GET(request:NextRequest,{params}:{params:{id:string}}) {
  try {
    const user=await access(request),store=new R2VideoStore(user.id),record=await store.readDialogue<DialogueRecording>(params.id);
    if(record?.status!=='COMPLETED')throw new WaveSpeedError('JOB_NOT_FOUND',404);
    return new NextResponse(await store.dialogueAudio(params.id),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store'}});
  }catch(e){return apiError(e);}
}
