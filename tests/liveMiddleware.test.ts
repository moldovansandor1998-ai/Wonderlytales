import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth',()=>({createMiddlewareSupabase:vi.fn()}));
import {createMiddlewareSupabase} from '@/lib/auth';
import {middleware} from '@/middleware';
describe('Live route authentication ownership',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','test');});
 afterEach(()=>vi.unstubAllEnvs());
 it('leaves only the two self-authenticating POST paths to their route guard',async()=>{
  for(const path of ['/api/live-studio/respond','/api/live-studio/speech/stream']){
   const response=await middleware(new NextRequest(`https://studio.example${path}`,{method:'POST'}));
   expect(response.headers.get('x-middleware-next')).toBe('1');
  }
  expect(createMiddlewareSupabase).not.toHaveBeenCalled();
 });
 it('continues checking sessions for other methods, paths and suffixes',async()=>{
  const getUser=vi.fn().mockResolvedValue({data:{user:null}});
  vi.mocked(createMiddlewareSupabase).mockReturnValue({auth:{getUser}} as never);
  for(const [path,method] of [['/api/live-studio/respond','GET'],['/api/live-studio/respond/extra','POST'],['/api/live-studio/speech','POST'],['/live-studio','GET']]){
   expect((await middleware(new NextRequest(`https://studio.example${path}`,{method}))).status).toBe(307);
  }
  expect(getUser).toHaveBeenCalledTimes(4);
 });
});
