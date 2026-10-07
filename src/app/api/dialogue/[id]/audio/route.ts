import { NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DialogueLine } from '@/lib/types';
import { getStorage } from '@/lib/providers/storage';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:{id:string}}) {
  const user=await getStudioUser();
  if (!user || !['admin','studio'].includes(user.role)) return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const line=await (await getDb()).get<DialogueLine>('dialogue_lines',params.id);
  if (!line?.audio_path?.startsWith('audio/tts/hu/')) return NextResponse.json({error:'NOT_RECORDED'},{status:404});
  return new NextResponse(new Uint8Array(await getStorage().get(line.audio_path)),{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store'}});
}
