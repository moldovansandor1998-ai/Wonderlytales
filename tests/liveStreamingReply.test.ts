import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {z} from 'zod';
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn(),getProductionBudget:vi.fn()}));
vi.mock('@vercel/oidc',()=>({getVercelOidcToken:vi.fn()}));
import {getProductionBudget,reserveProductionBudget} from '@/lib/budget';
import {generateLiveReply} from '@/lib/live/ai';
import {generateStreamingDialogue,streamingMessages} from '@/lib/live/dialogue-stream';
import {readCompletionStream} from '@/lib/live/completion-stream';
import {readStreamingResponse} from '@/lib/live/response-stream';
import {GiftPriority,GiftInterruption} from '@/lib/live/gift-priority';
const encoder=new TextEncoder();
const input={event:{id:'c',type:'comment' as const,user:'Béla',text:'Ali, miért ül Isti folyton?',count:1},history:[]};
const sse=(text:string)=>`data: ${JSON.stringify({choices:[{delta:{content:text},finish_reason:null}]})}\n\n`;
function feed(){let control!:ReadableStreamDefaultController<Uint8Array>;const cancel=vi.fn();const body=new ReadableStream<Uint8Array>({start(c){control=c;},cancel});return {response:new Response(body),put:(s:string)=>control.enqueue(encoder.encode(s)),end:()=>control.close(),cancel};}
describe('Incremental live reply',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LIVE_AI_GATEWAY_ENABLED','true');vi.stubEnv('AI_GATEWAY_API_KEY','test');vi.mocked(getProductionBudget).mockResolvedValue({configured_services:{live_ai:0.06}} as never);});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it('speaks the named first sentence before the remaining model output arrives, without repeating it',async()=>{
  const stream=feed(),spoken=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(stream.response));
  const pending=generateStreamingDialogue(input,new AbortController().signal,spoken);
  stream.put(sse('Isti ma is ülősztrájkot tart. '));
  await vi.waitFor(()=>expect(spoken).toHaveBeenCalledOnce());
  expect(spoken.mock.calls[0][1]).toBe('Béla, Isti ma is ülősztrájkot tart.');
  stream.put(sse('Csak még követelése sincs.'));stream.put('data: [DONE]\n\n');stream.end();
  const result=await pending;
  expect(spoken.mock.calls[1][1]).toBe('Csak még követelése sincs.');
  expect(result.turns[0].text).toBe('Béla, Isti ma is ülősztrájkot tart. Csak még követelése sincs.');
  expect(reserveProductionBudget).toHaveBeenCalledOnce();
 });
 it('uses priority within the existing reservation and keeps unsupported reasoning disabled out of requests',async()=>{
  const stream=feed();const fetch=vi.fn().mockResolvedValue(stream.response);vi.stubGlobal('fetch',fetch);
  const pending=generateStreamingDialogue(input,new AbortController().signal,vi.fn());
  stream.put(sse('Isti ma is ülősztrájkot tart.'));stream.put('data: [DONE]\n\n');stream.end();await pending;
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({stream:true,service_tier:'priority',reasoning_effort:'low',max_completion_tokens:800});
  expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('response_format');
  const tooLong=await generateLiveReply([{role:'user',content:'x'.repeat(8001)}],z.any(),new AbortController().signal,220,{onText:vi.fn(),toReply:t=>t});
  expect(tooLong.status).toBe(400);expect(fetch).toHaveBeenCalledOnce();
 });
 it('retains anti-repetition validation and never retries after part of a reply was spoken',async()=>{
  const stream=feed(),spoken=vi.fn();const fetch=vi.fn().mockResolvedValue(stream.response);vi.stubGlobal('fetch',fetch);
  const pending=generateStreamingDialogue(input,new AbortController().signal,spoken);const failed=expect(pending).rejects.toThrow('AI_INVALID_REPLY');
  stream.put(sse('Isti ma is ülősztrájkot tart. '));await vi.waitFor(()=>expect(spoken).toHaveBeenCalledOnce());
  stream.put(sse('A pizza a hibás!'));stream.put('data: [DONE]\n\n');stream.end();await failed;
  expect(fetch).toHaveBeenCalledOnce();expect(spoken).toHaveBeenCalledOnce();
 });
 it('does not mistake a split punctuation token or one-word echo for a complete response',async()=>{
  const stream=feed(),spoken=vi.fn();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(stream.response));
  const pending=generateStreamingDialogue(input,new AbortController().signal,spoken);
  stream.put(sse('Isti ma is ülősztrájkot tart!'));stream.put(sse('! '));
  await vi.waitFor(()=>expect(spoken).toHaveBeenCalledOnce());expect(spoken.mock.calls[0][1]).toMatch(/tart!!$/);
  stream.put('data: [DONE]\n\n');stream.end();await pending;expect(spoken).toHaveBeenCalledOnce();
 });
 it('trims only oldest context to bound priority cost while retaining the current comment and humor rules',()=>{
  const messages=streamingMessages({...input,history:Array.from({length:8},(_,i)=>({user:`Néző${i}`,text:'k'.repeat(500),reply:'válasz '.repeat(70)}))});
  expect(Buffer.byteLength(JSON.stringify(messages),'utf8')).toBeLessThanOrEqual(8000);
  expect(messages[0].content).toContain('VÁLTOZATOSSÁG');expect(messages[0].content).toContain('SZEREPEK ÉS CÉLPONT');
  expect(messages[0].content).not.toContain('Csak JSON:');expect(JSON.parse(messages[1].content).incomingEvent).toEqual(input.event);
 });
 it('handles split UTF-8/SSE frames and ignores reasoning deltas',async()=>{
  const source=`data: {"choices":[{"delta":{"reasoning":"not public"}}]}\r\n\r\n${sse('Árvíztűrő tükörfúrógép.')}data: [DONE]\n\n`;
  const bytes=encoder.encode(source),parts=new ReadableStream<Uint8Array>({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}});
  const cb=vi.fn();const result=await readCompletionStream(new Response(parts),new AbortController().signal,cb);
  expect(result.choices[0].message.content).toBe('Árvíztűrő tükörfúrógép.');expect(cb).toHaveBeenCalledOnce();
 });
 it('rejects truncated provider streams rather than accepting partial output',async()=>{
  const stream=feed();stream.put(sse('Hello'));stream.end();await expect(readCompletionStream(stream.response,new AbortController().signal,vi.fn())).rejects.toThrow('AI_INVALID_REPLY');
 });
 it('starts browser audio before the final dialogue and preserves the full caption for history',async()=>{
  const stream=feed(),controller=new AbortController();const resultPromise=readStreamingResponse(stream.response,controller.signal);
  const turn={speaker:'ali',text:'Béla, Isti ma is ülősztrájkot tart.',emotion:'laugh'};
  stream.put(JSON.stringify({type:'turn',turn})+'\n');const result=await resultPromise;
  const audio=result.audio.body!.getReader();stream.put(JSON.stringify({type:'audio',audio:'AQID'})+'\n');
  expect((await audio.read()).value).toEqual(new Uint8Array([1,2,3]));
  const dialogue={turns:[{...turn,text:turn.text+' Csak még követelése sincs.'}]};
  stream.put(JSON.stringify({type:'done',dialogue})+'\n');stream.end();expect(await result.completed).toEqual(dialogue);expect((await audio.read()).done).toBe(true);
 });
 it('cancels the same request and audio stream on gift interruption',async()=>{
  const stream=feed(),controller=new AbortController();const pending=readStreamingResponse(stream.response,controller.signal);
  stream.put(JSON.stringify({type:'turn',turn:{speaker:'ali',text:'Béla, egy értelmes mondat.',emotion:'laugh'}})+'\n');
  const reply=await pending,reader=reply.audio.body!.getReader();controller.abort(new GiftInterruption());
  await expect(reply.completed).rejects.toThrow('Ajándék');await expect(reader.read()).rejects.toThrow('Ajándék');expect(stream.cancel).toHaveBeenCalledOnce();
 });
 it('settles the old voice before a gift can play and never cancels preparation',async()=>{
  const priority=new GiftPriority(),controller=new AbortController();let audible=true;
  const playing=priority.playComment(controller,()=>new Promise<void>((_,reject)=>controller.signal.addEventListener('abort',()=>{audible=false;reject(controller.signal.reason);},{once:true})));
  priority.notify();await expect(playing).rejects.toBeInstanceOf(GiftInterruption);expect(audible).toBe(false);
  const next=new AbortController();priority.notify();expect(next.signal.aborted).toBe(false);
 });
});
