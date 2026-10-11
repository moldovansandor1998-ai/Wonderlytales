import { NextRequest, NextResponse } from 'next/server';
import { access, apiError } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const user = await access(request);
    const image = await new R2VideoStore(user.id).getImage(request.nextUrl.searchParams.get('sha256') ?? '');
    return new NextResponse(image.bytes,{ headers: { 'Content-Type': image.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (e) { return apiError(e); }
}
