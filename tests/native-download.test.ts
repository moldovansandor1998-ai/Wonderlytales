import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ role: 'studio' as string | null, exists: true, signed: [] as string[] }));
vi.mock('@/lib/auth', () => ({ getStudioUser: async () => state.role ? { role: state.role } : null }));
vi.mock('@/lib/providers/storage', () => ({ getStorage: () => ({
  exists: async () => state.exists,
  signedUrl: async (key: string, ttl: number) => { state.signed.push(`${key}:${ttl}`); return 'https://storage.example/private-file'; },
}) }));
import { GET } from '@/app/api/native-assets/download/route';
const digest = 'a'.repeat(64);
const source = `native/S1E1/uploads/${digest}/WonderlyTales_quality_rebuild_V006.blend`;
const request = (key: string) => new NextRequest(`https://studio.example/api/native-assets/download?${new URLSearchParams({ key })}`);
beforeEach(() => { state.role = 'studio'; state.exists = true; state.signed = []; });
describe('private native downloads', () => {
  it('requires authentication and studio authorization for source access', async () => {
    state.role = null; expect((await GET(request(source))).status).toBe(401);
    state.role = 'viewer'; expect((await GET(request(source))).status).toBe(403);
    expect(state.signed).toEqual([]);
  });
  it('allows a stored scene and keeps the signed redirect private and short lived', async () => {
    const result = await GET(request(source));
    expect(result.status).toBe(307);
    expect(result.headers.get('Cache-Control')).toBe('private, no-store');
    expect(state.signed).toEqual([`${source}:300`]);
  });
  it('rejects other storage namespaces, incomplete uploads and traversal', async () => {
    for (const key of [`assets/${digest}/secret.blend`, source.replace('S1E1','S1E2'), source.replace('V006.blend','V006.blend.part'), source.replace('WonderlyTales_quality_rebuild_V006.blend','../secret.blend')]) {
      expect((await GET(request(key))).status).toBe(400);
    }
    expect(state.signed).toEqual([]);
  });
  it('does not sign a missing source', async () => {
    state.exists = false; expect((await GET(request(source))).status).toBe(404);
    expect(state.signed).toEqual([]);
  });
  it('preserves existing video and image downloads', async () => {
    for (const file of ['clip.mp4', 'frame_000001.png']) expect((await GET(request(`renders/native/S1E1/${digest}/${digest}/${file}`))).status).toBe(307);
  });
});
