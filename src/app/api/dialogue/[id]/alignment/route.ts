import { NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dialogueRecording } from '@/lib/dialogueRecording';
import { getStorage } from '@/lib/providers/storage';
import { readRecordedSpeech } from '@/lib/speechTiming';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getStudioUser();
  if (!user || !['admin', 'studio'].includes(user.role)) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const { line, path, character, scene } = await dialogueRecording(await getDb(), params.id);
    const storage = getStorage();
    const review = await readRecordedSpeech(storage, await storage.get(path), line.text);
    if (!review) return NextResponse.json({ error: 'NOT_REVIEWED' }, { status: 404 });
    if (!review.usable_for_lipsync) return NextResponse.json({ error: 'ALIGNMENT_REVIEW_REQUIRED', review }, { status: 409 });
    return NextResponse.json({ ...review, dialogue_id: line.id, character_id: character.id,
      character_code: character.code, scene_id: scene.id, source_path: path },
      { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'INVALID_RECORDING_OR_ALIGNMENT' }, { status: 409 });
  }
}
