import { NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dialogueRecording } from '@/lib/dialogueRecording';
import { getStorage } from '@/lib/providers/storage';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:{id:string}}) {
  const user=await getStudioUser();
  if (!user || !['admin','studio'].includes(user.role)) return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  try {
    const { path } = await dialogueRecording(await getDb(), params.id);
    return new NextResponse(new Uint8Array(await getStorage().get(path)), { headers: {
      'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'INVALID_RECORDING' }, { status: 409 });
  }
}
