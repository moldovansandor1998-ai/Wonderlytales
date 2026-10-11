import { NextRequest } from 'next/server';
import { access, apiError, json, readJson, videoService } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const user = await access(request,true);
    return json(await videoService(new R2VideoStore(user.id)).quote(await readJson(request)));
  } catch (e) { return apiError(e); }
}
