import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaveSpeedClient, waveSpeedPayload } from '@/lib/providers/wavespeed';
import { WaveSpeedVideoService } from '@/lib/ai-video/service';
import { imageMetadata, type VideoStore } from '@/lib/ai-video/storage';
import { WAVESPEED_MODEL, type VideoJob, type VideoInput } from '@/lib/ai-video/shared';

const input: VideoInput = { id:'88e0a917-c216-4450-b8ef-641f6d49f719', imageSha256:'a'.repeat(64),
  prompt:'The exact fox walks along the street, then reacts to a brake sound.',duration:10,sound:true,maxCostUsd:1.68 };
const response = (data: unknown) => new Response(JSON.stringify({code:200,data}),{headers:{'Content-Type':'application/json'}});
function memoryStore(): VideoStore {
  const jobs = new Map<string,{job:VideoJob;etag:string}>(); let revision=0;
  return { async read(id) { return structuredClone(jobs.get(id) ?? null); },
    async claim(job) { if (jobs.has(job.id)) return false; jobs.set(job.id,{job:structuredClone(job),etag:String(++revision)}); return true; },
    async save(job,etag) { if (jobs.get(job.id)?.etag!==etag) return false; jobs.set(job.id,{job:structuredClone(job),etag:String(++revision)});return true; },
  };
}
describe('WaveSpeed paid-job boundaries',()=>{
  const fetch = vi.fn(); let reserve: ReturnType<typeof vi.fn>; let price=1.68; let balance=5;
  let submissions=0;
  beforeEach(()=>{
    vi.stubGlobal('fetch',fetch);fetch.mockReset();reserve=vi.fn().mockResolvedValue(undefined);submissions=0;price=1.68;balance=5;
    fetch.mockImplementation(async (url:string,init?:RequestInit)=>{
      if(url.endsWith('/model/price')) return response({model_id:WAVESPEED_MODEL,currency:'USD',discounted_price:price});
      if(url.endsWith('/balance')) return response({balance});
      if(url.endsWith('/result')) return response({id:'task-1',status:'completed',outputs:['https://cdn.example.test/real.mp4']});
      submissions++;expect(reserve.mock.invocationCallOrder[0]).toBeLessThan(fetch.mock.invocationCallOrder[fetch.mock.invocationCallOrder.length-1]);expect(init?.method).toBe('POST');
      return response({id:'task-1',status:'created',outputs:[]});
    });
  });
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  const service=(store=memoryStore(),url=async()=> 'https://private.example.test/reference.png?signature=secret') => new WaveSpeedVideoService(new WaveSpeedClient('test-only-key'),store,url,reserve);
  it('submits the documented payload, stores id, never stores the key or signed input URLs',async()=>{
    const p=service(); const job=await p.submit(input);
    expect(job.status).toBe('QUEUED');expect(job.taskId).toBe('task-1');expect(submissions).toBe(1);expect(reserve).toHaveBeenCalledWith(1.68);
    const submit=fetch.mock.calls.find(([url])=>url.endsWith(WAVESPEED_MODEL));
    expect(JSON.parse(submit![1].body)).toMatchObject({image:expect.stringContaining('https:'),duration:10,sound:true,shot_type:'customize'});
    expect(JSON.stringify(job)).not.toContain('signature');expect(JSON.stringify(job)).not.toContain('test-only-key');
  });
  it('replay after restart and concurrent duplicate requests create only one paid task',async()=>{
    const store=memoryStore();await Promise.all([service(store).submit(input),service(store).submit(input)]);
    await service(store).submit(input);expect(submissions).toBe(1);expect(reserve).toHaveBeenCalledTimes(1);
  });
  it('refuses changes under an existing id',async()=>{
    const p=service();await p.submit(input);
    await expect(p.submit({...input,prompt:'Change the character completely.'})).rejects.toThrow('JOB_ALREADY_EXISTS');expect(submissions).toBe(1);
  });
  it('rejects unknown request fields and longer paid durations before any network call',async()=>{
    await expect(service().submit({...input,duration:15} as unknown as VideoInput)).rejects.toThrow();
    await expect(service().submit({...input,model:'different'} as VideoInput)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects a price increase or insufficient balance before claiming/reserving/submitting',async()=>{
    price=1.69;await expect(service().submit(input)).rejects.toThrow('PRICE_CHANGED');
    price=1.68;balance=0;await expect(service().submit(input)).rejects.toThrow('BALANCE_LOW');expect(reserve).not.toHaveBeenCalled();expect(submissions).toBe(0);
  });
  it('a budget refusal produces a durable blocked job without any provider submission',async()=>{
    reserve.mockRejectedValue(new Error('Daily limit'));const p=service();
    expect((await p.submit(input)).status).toBe('BLOCKED_BUDGET');await p.submit(input);expect(submissions).toBe(0);expect(reserve).toHaveBeenCalledTimes(1);
  });
  it('an unowned or absent image prevents price, balance and paid calls',async()=>{
    await expect(service(memoryStore(),async()=>{throw new Error('not found');}).submit(input)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
  });
  it('never resubmits an ambiguous POST, including after service restart',async()=>{
    const store=memoryStore();const original=fetch.getMockImplementation()!;
    fetch.mockImplementation(async(url,init)=>{if(String(url).endsWith(WAVESPEED_MODEL)){submissions++;throw new Error('connection lost');}return original(url,init);});
    expect((await service(store).submit(input)).status).toBe('SUBMISSION_UNCERTAIN');
    await service(store).submit(input);expect(submissions).toBe(1);expect(reserve).toHaveBeenCalledTimes(1);
  });
  it('keeps failed jobs terminal without paid retries',async()=>{
    const p=service();await p.submit(input);fetch.mockResolvedValue(response({id:'task-1',status:'failed',error:'secret provider details'}));
    const job=await p.poll(input.id);expect(job.status).toBe('FAILED');expect(job.error).not.toContain('secret');
    await p.poll(input.id);await p.submit(input);expect(submissions).toBe(1);expect(reserve).toHaveBeenCalledTimes(1);
  });
  it('polls the exact task and returns a real output without claiming quality approval',async()=>{
    const p=service();await p.submit(input);const job=await p.poll(input.id);
    expect(job.status).toBe('COMPLETED');expect(job.outputUrl).toBe('https://cdn.example.test/real.mp4');
    expect(job.mediaVerified).toBe(false);expect(job.productionApproved).toBe(false);
    const n=fetch.mock.calls.length;await p.poll(input.id);expect(fetch.mock.calls.length).toBe(n);
  });
  it('does not regress completed jobs when a slower poll returns processing',async()=>{
    const store=memoryStore();const p=service(store);await p.submit(input);
    let resolveSlow:(r:Response)=>void=()=>{};let n=0;
    fetch.mockImplementation(()=>++n===1?new Promise<Response>(r=>{resolveSlow=r;}):Promise.resolve(response({id:'task-1',status:'completed',outputs:['https://cdn.example.test/real.mp4']})));
    const slow=p.poll(input.id);await new Promise(r=>setTimeout(r,0));await p.poll(input.id);
    resolveSlow(response({id:'task-1',status:'processing'}));expect((await slow).status).toBe('COMPLETED');
  });
  it('rejects an unexpected provider task id or non-HTTPS output',async()=>{
    const p=service();await p.submit(input);fetch.mockResolvedValue(response({id:'another-id',status:'completed',outputs:['https://cdn.example.test/movie.mp4']}));
    await expect(p.poll(input.id)).rejects.toThrow('INVALID_TASK');
    fetch.mockResolvedValue(response({id:'task-1',status:'completed',outputs:['javascript:bad']}));
    await expect(p.poll(input.id)).rejects.toThrow('INVALID_VIDEO_URL');
  });
  it('checks business errors in successful HTTP responses and never falls back to mock success',async()=>{
    fetch.mockImplementation(async()=>new Response(JSON.stringify({code:4005,message:'private data'})));
    await expect(service().quote(input)).rejects.toThrow('WAVESPEED_REQUEST_FAILED');expect(submissions).toBe(0);
    expect(()=>new WaveSpeedClient('')).toThrow('WAVESPEED_NOT_CONFIGURED');
  });
  it('keeps optional start/end frames as explicit model parameters',()=>{
    const payload=waveSpeedPayload(input,'https://start.test/a.png','https://end.test/b.png');
    expect(payload.end_image).toBe('https://end.test/b.png');expect(payload).not.toHaveProperty('locked_character_ids');
    expect(payload).not.toHaveProperty('resolution');
  });
});
describe('image validation',()=>{
  it('preserves 3:2 input dimensions and refuses undersized or disguised files',()=>{
    const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.write('IHDR',12);png.writeUInt32BE(1536,16);png.writeUInt32BE(1024,20);
    expect(imageMetadata(png)).toEqual({width:1536,height:1024,mime:'image/png'});
    png.writeUInt32BE(99,16);expect(()=>imageMetadata(png)).toThrow('INVALID_IMAGE');
    expect(()=>imageMetadata(Buffer.from('<svg onload="bad"/>'))).toThrow('INVALID_IMAGE');
  });
});

it('binds reusable character elements without replacing the continuing first frame',()=>{
 const p=waveSpeedPayload({...input,elements:[{elementId:'12345',name:'Mira',referenceSha256:'b'.repeat(64)}]},'https://start.test/last-frame.png');
 expect(p.image).toBe('https://start.test/last-frame.png');expect(p.element_list).toEqual([{element_id:'12345'}]);expect(p.prompt).toContain('Mira');
});
