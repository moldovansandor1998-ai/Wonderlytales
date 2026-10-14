import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth',()=>({requireStudioUser:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {requireStudioUser} from '@/lib/auth';
import {reserveProductionBudget} from '@/lib/budget';
import {POST} from '@/app/api/live-studio/speech/stream/route';
const request=(body:unknown={text:'Szia!',voiceId:'IstiVoice'},origin='https://studio.example')=>new NextRequest('https://studio.example/api/live-studio/speech/stream',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
describe('Live audio streaming',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('ELEVENLABS_API_KEY','test');vi.mocked(requireStudioUser).mockResolvedValue({id:'u',email:'u@example.com',role:'studio'});});
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('checks identity, origin and input before reserving or contacting the provider',async()=>{
  vi.mocked(requireStudioUser).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request({},'https://evil.example'))).status).toBe(403);
  expect((await POST(request({text:'x',voiceId:'../bad'}))).status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();expect(reserveProductionBudget).not.toHaveBeenCalled();
 });
 it('forwards audio before generation finishes, and cancellation reaches the same stream',async()=>{
  const cancel=vi.fn();let upstream!:ReadableStreamDefaultController<Uint8Array>;
  const stream=new ReadableStream<Uint8Array>({start(c){upstream=c;c.enqueue(new Uint8Array([1,2,3]));},cancel});
  const fetch=vi.fn(async()=>{expect(reserveProductionBudget).toHaveBeenCalledOnce();return new Response(stream);});vi.stubGlobal('fetch',fetch);
  const result=await POST(request());expect(result.headers.get('content-type')).toBe('audio/mpeg');
  const reader=result.body!.getReader();expect((await reader.read()).value).toEqual(new Uint8Array([1,2,3]));
  upstream.enqueue(new Uint8Array([4]));expect((await reader.read()).value).toEqual(new Uint8Array([4]));
  await reader.cancel();expect(cancel).toHaveBeenCalledOnce();expect(fetch).toHaveBeenCalledOnce();
 });
 it('does not retry a failed paid generation',async()=>{
  const fetch=vi.fn().mockRejectedValue(new Error('network'));vi.stubGlobal('fetch',fetch);
  expect((await POST(request())).status).toBe(503);expect(fetch).toHaveBeenCalledOnce();expect(reserveProductionBudget).toHaveBeenCalledOnce();
 });
});
