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
    const storage = getStorage();
    if (!(await storage.exists(key)))
      return NextResponse.json({ error: 'RENDER_UNAVAILABLE' }, { status: 404 });
    const response = NextResponse.redirect(await storage.signedUrl(key, 300), 307);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch { return NextResponse.json({ error: 'RENDER_UNAVAILABLE' }, { status: 404 }); }
}
