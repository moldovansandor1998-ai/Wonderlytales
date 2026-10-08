import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getStorage } from '@/lib/providers/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const chunkSize = 3 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getStudioUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  if (!['admin', 'studio'].includes(user.role)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'INVALID_ORIGIN' }, { status: 403 });
  }
  const digest = request.nextUrl.searchParams.get('sha256') ?? '';
  const name = request.nextUrl.searchParams.get('name') ?? '';
  const size = Number(request.nextUrl.searchParams.get('size'));
  if (!/^[a-f0-9]{64}$/.test(digest) || !/^[A-Za-z0-9_-]+\.blend$/.test(name)
      || !Number.isSafeInteger(size) || size < 12 || size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: 'INVALID_NATIVE_SOURCE' }, { status: 400 });
  }
  const count = Math.ceil(size / chunkSize);
  const prefix = `native/S1E1/uploads/${digest}`;
  const storage = getStorage();
  try {
    if (request.nextUrl.searchParams.get('action') === 'chunk') {
      const index = Number(request.nextUrl.searchParams.get('index'));
      if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
        return NextResponse.json({ error: 'INVALID_CHUNK' }, { status: 400 });
      }
      const bytes = Buffer.from(await request.arrayBuffer());
      const expected = Math.min(chunkSize, size - index * chunkSize);
      if (bytes.length !== expected) return NextResponse.json({ error: 'INVALID_CHUNK_SIZE' }, { status: 400 });
      const chunkDigest = createHash('sha256').update(bytes).digest('hex');
      await storage.put(`${prefix}/part_${index}`, bytes, 'application/octet-stream', { sha256: chunkDigest });
      return NextResponse.json({ index, sha256: chunkDigest });
    }
    if (request.nextUrl.searchParams.get('action') !== 'complete') {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 });
    }
    const key = `${prefix}/${name}`;
    if (await storage.exists(key)) {
      const existing = await storage.get(key);
      if (createHash('sha256').update(existing).digest('hex') !== digest) throw new Error('CHECKSUM_MISMATCH');
      return NextResponse.json({ key, sha256: digest, bytes: existing.length, production_approved: false });
    }
    const chunks: Buffer[] = [];
    for (let index = 0; index < count; index++) {
      const chunk = await storage.get(`${prefix}/part_${index}`);
      if (chunk.length !== Math.min(chunkSize, size - index * chunkSize)) throw new Error('INVALID_CHUNK_SIZE');
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('CHECKSUM_MISMATCH');
    const rawBlend = bytes.subarray(0, 7).toString('ascii') === 'BLENDER';
    const packedBlend = bytes.subarray(0, 4).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]));
    if (!rawBlend && !packedBlend) throw new Error('NOT_A_BLEND_FILE');
    await storage.put(key, bytes, 'application/octet-stream', { sha256: digest, status: 'NATIVE_DRAFT' });
    return NextResponse.json({ key, sha256: digest, bytes: size, production_approved: false });
  } catch {
    return NextResponse.json({ error: 'NATIVE_UPLOAD_FAILED' }, { status: 502 });
  }
}
