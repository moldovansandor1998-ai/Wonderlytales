import { NextRequest } from 'next/server';
import { access, apiError, json } from '@/lib/ai-video/http';
import { R2VideoStore, MAX_IMAGE_BYTES, UPLOAD_CHUNK_BYTES } from '@/lib/ai-video/storage';
import { WaveSpeedError } from '@/lib/providers/wavespeed';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    const user = await access(request,true);
    const params = request.nextUrl.searchParams;
    const sha = params.get('sha256') ?? '', size = Number(params.get('size'));
    if (!/^[a-f0-9]{64}$/.test(sha) || !Number.isSafeInteger(size) || size < 33 || size > MAX_IMAGE_BYTES) throw new WaveSpeedError('INVALID_IMAGE',400);
    const store = new R2VideoStore(user.id);
    if (params.get('action') === 'complete') return json(await store.completeImage(sha,size));
    const index = Number(params.get('index'));
    if (params.get('action') !== 'chunk' || !Number.isSafeInteger(index) || index < 0 || index >= Math.ceil(size / UPLOAD_CHUNK_BYTES)) throw new WaveSpeedError('INVALID_IMAGE',400);
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length !== Math.min(UPLOAD_CHUNK_BYTES,size - index * UPLOAD_CHUNK_BYTES)) throw new WaveSpeedError('INVALID_IMAGE',400);
    await store.putChunk(sha,index,bytes);
    return json({ index });
  } catch (e) { return apiError(e); }
}
