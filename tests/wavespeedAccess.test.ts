import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const auth=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/auth',()=>({requireStudioUser:auth}));
import { POST } from '@/app/api/ai-video/jobs/route';
import { GET as media } from '@/app/api/ai-video/jobs/[id]/media/route';
import { access } from '@/lib/ai-video/http';
beforeEach(()=>auth.mockResolvedValue({id:'owner-1',role:'studio'}));
afterEach(()=>vi.unstubAllEnvs());
it('denies unauthenticated and viewer users before storage or provider setup',async()=>{
  auth.mockRejectedValueOnce(new Error('UNAUTHORIZED'));
  expect((await POST(new NextRequest('https://wonderlytales.vercel.app/api/ai-video/jobs',{method:'POST'}))).status).toBe(401);
  auth.mockRejectedValueOnce(new Error('FORBIDDEN'));
  expect((await media(new NextRequest('https://wonderlytales.vercel.app/api/ai-video/jobs/one/media'),{params:{id:'one'}})).status).toBe(403);
});
it('rejects cross-site and origin-less paid submissions',async()=>{
  for(const origin of ['https://other.example','']) {
    const r=await POST(new NextRequest('https://wonderlytales.vercel.app/api/ai-video/jobs',{method:'POST',headers:origin?{origin}:{}}));
    expect(r.status).toBe(403);expect(await r.json()).toEqual({error:'INVALID_ORIGIN'});
  }
});
it('uses the authenticated owner for the same-origin request',async()=>{
  expect((await access(new NextRequest('https://wonderlytales.vercel.app/api/ai-video/jobs',{method:'POST',headers:{origin:'https://wonderlytales.vercel.app'}}),true)).id).toBe('owner-1');
});
