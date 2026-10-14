import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth',()=>({requireStudioUser:vi.fn()}));
vi.mock('@/lib/live/ai',()=>({generateLiveReply:vi.fn()}));
vi.mock('@/lib/live/speech',()=>({streamSpeech:vi.fn()}));
import {requireStudioUser} from '@/lib/auth';
import {generateLiveReply} from '@/lib/live/ai';
import {streamSpeech} from '@/lib/live/speech';
import {POST} from '@/app/api/live-studio/respond/route';
const payload={event:{id:'1',type:'comment',user:'Teszt',text:'Isti, táncolni nem tudsz?'},voices:{ali:'AliVoice',isti:'IstiVoice'}};
const request=(body:unknown=payload)=>new NextRequest('https://studio.example/api/live-studio/respond',{method:'POST',headers:{origin:'https://studio.example','content-type':'application/json'},body:JSON.stringify(body)});
describe('Comment to streamed speech in one request',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireStudioUser).mockResolvedValue({id:'u',email:'u@example.com',role:'studio'});});
 afterEach(()=>vi.unstubAllGlobals());
 it('validates all voices before any paid generation',async()=>{
  expect((await POST(request({...payload,voices:{ali:'',isti:'valid'}}))).status).toBe(400);
  expect(generateLiveReply).not.toHaveBeenCalled();expect(streamSpeech).not.toHaveBeenCalled();
 });
 it('never generates voice after an AI failure',async()=>{
  vi.mocked(generateLiveReply).mockResolvedValue(new Response(JSON.stringify({error:'AI_INVALID_REPLY'}),{status:502}) as any);
  expect((await POST(request())).status).toBe(502);expect(streamSpeech).not.toHaveBeenCalled();
  expect(generateLiveReply).toHaveBeenCalledTimes(2);
 });
 it('voices only the successful fresh reply after an unusable first attempt',async()=>{
  const dialogue={turns:[{speaker:'isti',text:'Teszt, A lábam indulna, de én még ülök!',emotion:'laugh'}]};
  vi.mocked(generateLiveReply).mockResolvedValueOnce(new Response(JSON.stringify({error:'AI_INVALID_REPLY'}),{status:502}) as any).mockResolvedValueOnce(new Response(JSON.stringify(dialogue)) as any);
  vi.mocked(streamSpeech).mockResolvedValue(new Response(new Uint8Array([1]),{headers:{'content-type':'audio/mpeg'}}));
  expect((await POST(request())).status).toBe(200);
  expect(generateLiveReply).toHaveBeenCalledTimes(2);expect(streamSpeech).toHaveBeenCalledOnce();
  expect(streamSpeech).toHaveBeenCalledWith({text:dialogue.turns[0].text,voiceId:'IstiVoice'},expect.any(AbortSignal));
 });
 it('uses the selected speaker and exposes the exact UTF-8 caption alongside the audio',async()=>{
  const dialogue={turns:[{speaker:'isti',text:'A padló fél tőlem!',emotion:'laugh'}]};
  vi.mocked(generateLiveReply).mockResolvedValue(new Response(JSON.stringify(dialogue)) as any);
  vi.mocked(streamSpeech).mockResolvedValue(new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}}));
  const response=await POST(request());
  expect(JSON.parse(decodeURIComponent(response.headers.get('X-Live-Dialogue')!))).toEqual(dialogue);
  expect(streamSpeech).toHaveBeenCalledOnce();expect(streamSpeech).toHaveBeenCalledWith({text:dialogue.turns[0].text,voiceId:'IstiVoice'},expect.any(AbortSignal));
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1,2,3]));
 });
 it('starts speech immediately after the first validated reply without a second paid model pass',async()=>{
  const dialogue={turns:[{speaker:'isti',text:'Teszt, A lábam indulna, de én még ülök!',emotion:'laugh'}]};
  vi.mocked(generateLiveReply).mockResolvedValueOnce(new Response(JSON.stringify(dialogue)) as any);
  vi.mocked(streamSpeech).mockResolvedValue(new Response(new Uint8Array([1])));
  expect((await POST(request())).status).toBe(200);
  expect(generateLiveReply).toHaveBeenCalledOnce();expect(streamSpeech).toHaveBeenCalledOnce();
 });
});
