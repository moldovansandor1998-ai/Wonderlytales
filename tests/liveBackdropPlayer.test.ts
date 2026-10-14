import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBackdropPlayer } from "@/lib/live/backdrop-player";
class Video extends EventTarget {
  paused=true; muted=false; error:{code:number}|null=null;
  play=vi.fn(async()=>{this.paused=false;});
  pause=vi.fn(()=>{this.paused=true;this.dispatchEvent(new Event("pause"));});
  load=vi.fn();
}
class Page extends EventTarget { visibilityState="visible";defaultView=new EventTarget(); }
const start=(video:Video,page:Page,onError=vi.fn())=>runBackdropPlayer(video as unknown as HTMLVideoElement,page as unknown as Document,onError);
describe("continuous mobile background",()=>{
  beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
  it("does not report a stale play rejection after stopping",async()=>{
    const video=new Video(),page=new Page(),fail=vi.fn();let reject!:(e:Error)=>void;
    video.play.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
    const stop=start(video,page,fail);stop();reject(new DOMException("interrupted by pause","AbortError"));
    await vi.runAllTimersAsync();expect(fail).not.toHaveBeenCalled();expect(video.play).toHaveBeenCalledOnce();
  });
  it("resumes an interrupted phone playback when the page becomes visible",async()=>{
    const video=new Video(),page=new Page(),fail=vi.fn();
    const stop=start(video,page,fail);await vi.advanceTimersByTimeAsync(0);
    page.visibilityState="hidden";video.pause();await vi.advanceTimersByTimeAsync(500);expect(video.play).toHaveBeenCalledOnce();
    page.visibilityState="visible";page.dispatchEvent(new Event("visibilitychange"));await vi.advanceTimersByTimeAsync(400);
    expect(video.play).toHaveBeenCalledTimes(2);expect(video.muted).toBe(true);expect(fail).not.toHaveBeenCalled();stop();
  });
  it("retries a transient play interruption without new media or generation",async()=>{
    const video=new Video(),page=new Page(),fail=vi.fn();video.play.mockRejectedValueOnce(new DOMException("load interruption","AbortError"));
    const stop=start(video,page,fail);await vi.advanceTimersByTimeAsync(400);
    expect(video.play).toHaveBeenCalledTimes(2);expect(video.load).not.toHaveBeenCalled();expect(fail).not.toHaveBeenCalled();stop();
  });
  it("stops automatic recovery for unsupported media and ignores errors after disposal",async()=>{
    const video=new Video(),page=new Page(),fail=vi.fn();const stop=start(video,page,fail);
    video.error={code:4};video.dispatchEvent(new Event("error"));await vi.advanceTimersByTimeAsync(1000);
    expect(fail).toHaveBeenCalledOnce();expect(fail.mock.calls[0][0]).toContain("dekódolni");
    stop();video.dispatchEvent(new Event("error"));expect(fail).toHaveBeenCalledOnce();
  });
});
