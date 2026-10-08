import { NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { DialogueLine } from '@/lib/types';
import { getStorage } from '@/lib/providers/storage';
import { recordingTimingKey } from '@/lib/speechTiming';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStudioUser();
  if (!user || !['admin', 'studio'].includes(user.role)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const line = await (await getDb()).get<DialogueLine>('dialogue_lines', params.id);
  if (!line || line.language !== 'hu' || !line.audio_path?.startsWith('audio/tts/hu/'))
    return NextResponse.json({ error: 'NOT_RECORDED' }, { status: 404 });
  const storage = getStorage();
  const key = recordingTimingKey(await storage.get(line.audio_path), line.text);
  if (!(await storage.exists(key))) return NextResponse.json({ error: 'NOT_REVIEWED' }, { status: 404 });
  return new NextResponse(new Uint8Array(await storage.get(key)), { headers: {
    'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
  }});
}
