import {NextRequest} from 'next/server';
import {z} from 'zod';
import {access, apiError, json, readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {mediaGallery} from '@/lib/ai-video/gallery';
import {preserveVideo} from '@/lib/ai-video/archive';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  try {
    const user = await access(request);
    const query = z.object({kind: z.enum(['images', 'videos', 'finished']).default('images'),
      cursor: z.string().min(1).max(4096).optional()}).parse(Object.fromEntries(request.nextUrl.searchParams));
    return json(await mediaGallery(new R2VideoStore(user.id), query.kind, query.cursor));
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await access(request, true);
    const {jobId} = z.object({jobId: z.string().uuid()}).strict().parse(await readJson(request));
    const job = await preserveVideo(new R2VideoStore(user.id), jobId);
    return json({archived: !!job.archived});
  } catch (error) { return apiError(error); }
}
