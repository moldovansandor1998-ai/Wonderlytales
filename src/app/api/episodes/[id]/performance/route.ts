import { NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { performanceItems } from '@/lib/performanceAudio';
import { getStorage } from '@/lib/providers/storage';
import { audioZip } from '@/lib/audioArchive';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getStudioUser();
  if (!user || !['admin','studio'].includes(user.role)) return NextResponse.json({error:'UNAUTHORIZED'}, {status:401});
  const items = await performanceItems(params.id), storage = getStorage(), clip = new URL(request.url).searchParams.get('clip');
  if (clip) {
    const item = items.find(i => i.id === clip);
    if (!item || !(await storage.exists(item.path))) return NextResponse.json({error:'NOT_FOUND'}, {status:404});
    return new NextResponse(new Uint8Array(await storage.get(item.path)), {headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store'}});
  }
  if (!(await Promise.all(items.map(i => storage.exists(i.path)))).every(Boolean)) return NextResponse.json({error:'A felvételek még készülnek.'}, {status:409});
  const entries = await Promise.all(items.map(async i => ({name:`${i.id}.mp3`, data:await storage.get(i.path)})));
  entries.push({name:'manifest.json',data:Buffer.from(JSON.stringify({status:'PERFORMANCE_REVIEW_V016',items},null,2))});
  return new NextResponse(new Uint8Array(audioZip(entries)), {headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Csodakapu_S1E1_eloadoi_hangok_V016.zip"','Cache-Control':'private, no-store'}});
}
