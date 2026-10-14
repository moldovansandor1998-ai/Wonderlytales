import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {PcmDecoder,playPcmStream} from "@/lib/live/pcm-stream";

class TestContext extends EventTarget {
  state = "running"; currentTime = 0; destination = {}; baseLatency = 0; outputLatency = 0;
  sources: any[] = [];
  createBuffer(_channels:number,length:number,rate:number) {
    return {duration:length/rate,copyToChannel:vi.fn()};
  }
  createBufferSource() {
    const source = {buffer:null as any,connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null as (()=>void)|null};
    this.sources.push(source); return source;
  }
  endAll() { for (const source of this.sources) source.onended?.(); }
}
function feed() {
  let control!:ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  return {response:new Response(new ReadableStream({start(c){control=c;},cancel})),put:(bytes:Uint8Array)=>control.enqueue(bytes),end:()=>control.close(),cancel};
}
const audio = () => new Uint8Array(4800).fill(32); // 100ms, non-silent, signed PCM
describe("Direct low-latency PCM playback",()=>{
  beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
  it("preserves signed samples across arbitrary odd byte boundaries",()=>{
    const decoder=new PcmDecoder();const bytes=new Uint8Array([0,128,255,127,255,255,0,0]);
    const samples=[...decoder.decode(bytes.slice(0,1)),...decoder.decode(bytes.slice(1,4)),...decoder.decode(bytes.slice(4,7)),...decoder.decode(bytes.slice(7))];
    expect(samples).toEqual([-1,32767/32768,-1/32768,0]);expect(()=>decoder.finish()).not.toThrow();
  });
  it("starts before EOF, keeps chunks contiguous and waits for the audio tail",async()=>{
    const source=feed(),context=new TestContext(),start=vi.fn(),done=vi.fn();
    const playing=playPcmStream(source.response,context as any,new AbortController().signal,start).then(done);
    source.put(audio());await vi.advanceTimersByTimeAsync(41);
    expect(start).toHaveBeenCalledOnce();expect(context.sources[0].start).toHaveBeenCalledWith(0.04);expect(done).not.toHaveBeenCalled();
    source.put(audio());await vi.advanceTimersByTimeAsync(1);
    expect(context.sources[1].start).toHaveBeenCalledWith(0.14);
    source.end();await vi.advanceTimersByTimeAsync(1);expect(done).not.toHaveBeenCalled();
    context.endAll();await playing;expect(done).toHaveBeenCalledOnce();expect(start).toHaveBeenCalledOnce();
  });
  it("stops all queued sound and cancels reading immediately on a gift interruption",async()=>{
    const source=feed(),context=new TestContext(),controller=new AbortController(),start=vi.fn();
    const playing=playPcmStream(source.response,context as any,controller.signal,start);
    const rejected=expect(playing).rejects.toThrow("gift");
    source.put(audio());await vi.advanceTimersByTimeAsync(1);controller.abort(new Error("gift"));await rejected;
    expect(context.sources[0].stop).toHaveBeenCalledOnce();expect(source.cancel).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100);expect(start).not.toHaveBeenCalled();
  });
  it("does not report leading silence as speech",async()=>{
    const source=feed(),context=new TestContext(),start=vi.fn();
    const playing=playPcmStream(source.response,context as any,new AbortController().signal,start);
    source.put(new Uint8Array(4800));await vi.advanceTimersByTimeAsync(50);expect(start).not.toHaveBeenCalled();
    source.put(audio());await vi.advanceTimersByTimeAsync(141);expect(start).toHaveBeenCalledOnce();
    source.end();await vi.advanceTimersByTimeAsync(1);context.endAll();await playing;
  });
  it("rejects a truncated sample and silences previously scheduled data",async()=>{
    const source=feed(),context=new TestContext();
    const playing=playPcmStream(source.response,context as any,new AbortController().signal);
    const rejected=expect(playing).rejects.toThrow("Megszakadt");
    source.put(audio());source.put(new Uint8Array([1]));source.end();await rejected;
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
  });
  it("fails promptly if the browser suspends the audio context",async()=>{
    const source=feed(),context=new TestContext();
    const playing=playPcmStream(source.response,context as any,new AbortController().signal);
    const rejected=expect(playing).rejects.toThrow("szüneteltette");
    source.put(audio());await vi.advanceTimersByTimeAsync(1);context.state="suspended";context.dispatchEvent(new Event("statechange"));
    await rejected;expect(context.sources[0].stop).toHaveBeenCalledOnce();expect(source.cancel).toHaveBeenCalledOnce();
  });
  it("propagates stream errors and never retries or leaves queued sound playing",async()=>{
    const context=new TestContext();let control!:ReadableStreamDefaultController<Uint8Array>;
    const response=new Response(new ReadableStream({start(c){control=c;}}));
    const playing=playPcmStream(response,context as any,new AbortController().signal);
    const rejected=expect(playing).rejects.toThrow("upstream");
    control.enqueue(audio());await vi.advanceTimersByTimeAsync(1);control.error(new Error("upstream"));
    await rejected;expect(context.sources[0].stop).toHaveBeenCalledOnce();
  });
});
