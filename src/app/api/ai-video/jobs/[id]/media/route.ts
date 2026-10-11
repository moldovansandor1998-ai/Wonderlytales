import { NextRequest, NextResponse } from 'next/server';
import { access, apiError } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
import { WaveSpeedError } from '@/lib/providers/wavespeed';
export const dynamic = 'force-dynamic';
export const maxDuration=120;
export async function GET(request: NextRequest,{ params }: { params: { id: string } }) {
  try {
    const user = await access(request);
    const store = new R2VideoStore(user.id);
    const saved = await store.read(params.id);
    if (saved?.job.status !== 'COMPLETED' || (!saved.job.archived && !saved.job.outputUrl?.startsWith('https://'))) throw new WaveSpeedError('JOB_NOT_FOUND',404);
    const range=request.headers.get('range');
    if(range && !/^bytes=\d*-\d*$/.test(range))throw new WaveSpeedError('INVALID_INPUT',400);
    const source=await fetch(await store.videoUrl(saved.job),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(90000),headers:range?{Range:range}:{}});
    if(!source.ok||!source.body)throw new WaveSpeedError('MEDIA_UNAVAILABLE');
    const headers=new Headers({'Content-Type':'video/mp4','Cache-Control':'private, no-store','Accept-Ranges':'bytes'});
    for(const h of ['content-length','content-range']){const v=source.headers.get(h);if(v)headers.set(h,v);}
    return new NextResponse(source.body,{status:source.status,headers});
  } catch (e) { return apiError(e); }
}
