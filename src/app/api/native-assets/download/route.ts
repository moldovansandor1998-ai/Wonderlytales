import { NextRequest, NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getStorage } from '@/lib/providers/storage';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const user = await getStudioUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!['admin', 'studio'].includes(user.role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  const key = request.nextUrl.searchParams.get('key') ?? '';
  if (!/^renders\/native\/S1E1\/[a-f0-9]{64}\/[a-f0-9]{64}\/(frame_\d{6}\.png|clip\.mp4)$/.test(key))
    return NextResponse.json({ error: 'INVALID_RENDER_KEY' }, { status: 400 });
  try {
    const bytes = await getStorage().get(key);
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'Content-Type': key.endsWith('.png') ? 'image/png' : 'video/mp4',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'private, no-store',
    }});
  } catch { return NextResponse.json({ error: 'RENDER_UNAVAILABLE' }, { status: 404 }); }
}
