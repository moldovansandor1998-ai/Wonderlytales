import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'studio' as string | null, objects: new Map<string, Buffer>(), puts: [] as string[] }));
vi.mock('@/lib/auth', () => ({ getStudioUser: async () => state.role ? { role: state.role } : null }));
vi.mock('@/lib/providers/storage', () => ({ getStorage: () => ({
  put: async (key: string, bytes: Buffer) => { state.puts.push(key); state.objects.set(key, bytes); },
  get: async (key: string) => { const bytes = state.objects.get(key); if (!bytes) throw new Error('MISSING'); return bytes; },
  exists: async (key: string) => state.objects.has(key),
}) }));
import { POST } from '@/app/api/native-assets/upload/route';

function request(bytes: Buffer, action = 'complete', body = '', extra: Record<string, string> = {}, origin = 'https://studio.example') {
  const query = new URLSearchParams({ sha256: createHash('sha256').update(bytes).digest('hex'), name: 'SC001.blend', size: String(bytes.length), action, ...extra });
  return new NextRequest(`https://studio.example/api/native-assets/upload?${query}`, {
    method: 'POST', headers: { origin }, body,
  });
}
beforeEach(() => { state.role = 'studio'; state.objects.clear(); state.puts.length = 0; });
describe('native source upload', () => {
  it('requires authentication and a Studio role before storing bytes', async () => {
    const bytes = Buffer.from('BLENDER-v450fixture');
    state.role = null;
    expect((await POST(request(bytes, 'chunk', bytes.toString(), { index: '0' }))).status).toBe(401);
    state.role = 'viewer';
    expect((await POST(request(bytes, 'chunk', bytes.toString(), { index: '0' }))).status).toBe(403);
    expect(state.puts).toEqual([]);
  });
  it('rejects foreign origins and traversal filenames', async () => {
    const bytes = Buffer.from('BLENDER-v450fixture');
    expect((await POST(request(bytes, 'chunk', bytes.toString(), { index: '0' }, 'https://foreign.example'))).status).toBe(403);
    expect((await POST(request(bytes, 'chunk', bytes.toString(), { index: '0', name: '../SC001.blend' }))).status).toBe(400);
    expect(state.puts).toEqual([]);
  });
  it('reassembles consecutive chunks and verifies the whole original file', async () => {
    const bytes = Buffer.from('BLENDER-v450' + 'x'.repeat(3 * 1024 * 1024));
    for (let index = 0, offset = 0; offset < bytes.length; index++, offset += 3 * 1024 * 1024) {
      expect((await POST(request(bytes, 'chunk', bytes.subarray(offset, offset + 3 * 1024 * 1024).toString(), { index: String(index) }))).status).toBe(200);
    }
    const result = await POST(request(bytes));
    expect(result.status).toBe(200);
    const receipt = await result.json();
    expect(state.objects.get(receipt.key)).toEqual(bytes);
    expect(receipt.production_approved).toBe(false);
    const writes = state.puts.length;
    expect((await POST(request(bytes))).status).toBe(200);
    expect(state.puts.length).toBe(writes);
  });
  it('never publishes incomplete or corrupted sources', async () => {
    const bytes = Buffer.from('BLENDER-v450fixture');
    expect((await POST(request(bytes))).status).toBe(502);
    await POST(request(bytes, 'chunk', 'BLENDER-v450corrupt', { index: '0' }));
    expect((await POST(request(bytes))).status).toBe(502);
    expect(state.puts.some(key => key.endsWith('.blend'))).toBe(false);
  });
  it('rejects an out-of-range chunk before a storage write', async () => {
    const bytes = Buffer.from('BLENDER-v450fixture');
    expect((await POST(request(bytes, 'chunk', bytes.toString(), { index: '1' }))).status).toBe(400);
    expect(state.puts).toEqual([]);
  });
});
