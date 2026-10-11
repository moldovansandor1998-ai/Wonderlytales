import { NextRequest } from 'next/server';
import { access, apiError, json, videoService } from '@/lib/ai-video/http';
import {preserveVideo} from '@/lib/ai-video/archive';
import { R2VideoStore } from '@/lib/ai-video/storage';
import { WaveSpeedError } from '@/lib/providers/wavespeed';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: NextRequest,{ params }: { params: { id: string } }) {
  try {
    const user = await access(request);
    const saved = await new R2VideoStore(user.id).read(params.id);
    if (!saved) throw new WaveSpeedError('JOB_NOT_FOUND',404);
    return json({ job: saved.job });
  } catch (e) { return apiError(e); }
}
export async function POST(request: NextRequest,{ params }: { params: { id: string } }) {
  try {
    const user = await access(request,true);
    const store = new R2VideoStore(user.id);
    await videoService(store).poll(params.id);
    return json({job: await preserveVideo(store, params.id)});
  } catch (e) { return apiError(e); }
}
