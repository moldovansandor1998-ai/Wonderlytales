import { NextRequest } from 'next/server';
import { access, apiError, json, readJson, videoService } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  try { const user = await access(request); return json({ jobs: await new R2VideoStore(user.id).list() }); }
  catch (e) { return apiError(e); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await access(request,true);
    return json({ job: await videoService(new R2VideoStore(user.id)).submit(await readJson(request)) });
  } catch (e) { return apiError(e); }
}
