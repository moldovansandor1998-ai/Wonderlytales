import {EventEmitter} from 'node:events';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const sockets=vi.hoisted(()=>({all:[] as any[]}));
vi.mock('ws',()=>({default:class extends EventEmitter {
 static OPEN=1;readyState=1;sent:any[]=[];
 constructor(public url:string,public options:any){super();sockets.all.push(this);queueMicrotask(()=>this.emit('open'));}
 send(value:string){this.sent.push(JSON.parse(value));}
 close(){this.readyState=3;this.emit('close');}
 terminate(){this.close();}
}}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {reserveProductionBudget} from '@/lib/budget';
import {openSpeechSocket} from '@/lib/live/speech-socket';
describe('Incremental ElevenLabs session',()=>{
 beforeEach(()=>{vi.clearAllMocks();sockets.all=[];vi.stubEnv('ELEVENLABS_API_KEY','test-only');});
 afterEach(()=>vi.unstubAllEnvs());
 it('reserves once, keeps the key server-side and sends validated sentences on the same session',async()=>{
  const onAudio=vi.fn(),controller=new AbortController();
  const speech=await openSpeechSocket('IstiVoice',controller.signal,onAudio);const socket=sockets.all[0];
  expect(reserveProductionBudget).toHaveBeenCalledOnce();expect(reserveProductionBudget).toHaveBeenCalledWith('tts');expect(socket.url).not.toContain('test-only');
  expect(socket.options.headers).toEqual({'xi-api-key':'test-only'});expect(socket.url).toContain('auto_mode=true');
  speech.send('Béla, itt az első mondat.');socket.emit('message',Buffer.from(JSON.stringify({audio:'AQID',isFinal:false})));
  expect(onAudio).toHaveBeenCalledWith('AQID');speech.send('Itt a második.');
  const finished=speech.finish();expect(socket.sent.map((m:any)=>m.text)).toEqual([' ','Béla, itt az első mondat. ','Itt a második. ','']);
  socket.emit('message',Buffer.from(JSON.stringify({isFinal:true})));await finished;expect(socket.readyState).toBe(3);
 });
 it('cancels the provider and never reconnects on interruption',async()=>{
  const controller=new AbortController();const speech=await openSpeechSocket('AliVoice',controller.signal,vi.fn());const socket=sockets.all[0];
  speech.send('Béla, itt az első mondat.');controller.abort(new Error('gift interruption'));
  await expect(speech.finish()).rejects.toThrow('gift interruption');expect(socket.readyState).toBe(3);expect(sockets.all).toHaveLength(1);
 });
 it('fails closed when the budget is unavailable',async()=>{
  vi.mocked(reserveProductionBudget).mockRejectedValueOnce(new Error('budget'));
  await expect(openSpeechSocket('AliVoice',new AbortController().signal,vi.fn())).rejects.toThrow('budget');expect(sockets.all).toHaveLength(0);
 });
 it('does not accept a silent or truncated final audio response',async()=>{
  const speech=await openSpeechSocket('AliVoice',new AbortController().signal,vi.fn());
  speech.send('Béla, itt az első mondat.');const finished=speech.finish();
  sockets.all[0].emit('message',Buffer.from(JSON.stringify({is_final:true})));
  await expect(finished).rejects.toThrow('VOICE_PROVIDER_ERROR');
 });
});
