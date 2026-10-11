import { NextRequest } from 'next/server';
import { z } from 'zod';
import { access, apiError, json, readJson } from '@/lib/ai-video/http';
import { R2VideoStore } from '@/lib/ai-video/storage';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  try {
    const user = await access(request);
    const kind = z.enum(['images', 'videos', 'edits']).parse(request.nextUrl.searchParams.get('kind') ?? 'videos');
    return json(await new R2VideoStore(user.id).galleryPage(kind, request.nextUrl.searchParams.get('cursor') ?? undefined));
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await access(request, true);
    const input = z.object({ id: z.string().uuid() }).strict().parse(await readJson(request));
    await new R2VideoStore(user.id).preserveVideo(input.id);
    return json({ archived: true });
  } catch (error) { return apiError(error); }
}
