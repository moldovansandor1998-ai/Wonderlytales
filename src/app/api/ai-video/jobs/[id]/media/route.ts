import { NextRequest, NextResponse } from 'next/server';
import { access, apiError } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
import { WaveSpeedError } from '@/lib/providers/wavespeed';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest,{ params }: { params: { id: string } }) {
  try {
    const user = await access(request);
    const saved = await new R2VideoStore(user.id).read(params.id);
    if (saved?.job.status !== 'COMPLETED' || !saved.job.outputUrl?.startsWith('https://')) throw new WaveSpeedError('JOB_NOT_FOUND',404);
    return NextResponse.redirect(saved.job.outputUrl, { status: 307, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return apiError(e); }
}
