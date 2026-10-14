import {describe,it,expect,vi} from "vitest";
import {GiftPriority} from "@/lib/live/gift-priority";
import {EventQueue,eventSchema} from "@/lib/live/events";
const gift=(id:string)=>eventSchema.parse({id,type:"gift",user:"Peti",giftValue:10});
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
describe("gifts during comment preparation",()=>{
 it("starts the gift before AI resolves, then keeps the original comment and never overlaps speech",async()=>{
  const priority=new GiftPriority(),queue=new EventQueue(),ai=deferred<string>(),playing=deferred<void>();
  const order:string[]=[];const play=vi.fn(async()=>{order.push("gift:start");await playing.promise;order.push("gift:end");});
  const result=priority.during(ai.promise,new AbortController().signal,()=>queue.takeGift(),play).then(value=>{order.push(value);});
  queue.add(gift("1"));priority.notify();await flush();expect(order).toEqual(["gift:start"]);
  ai.resolve("comment");await flush();expect(order).toEqual(["gift:start"]);
  playing.resolve();await result;expect(order).toEqual(["gift:start","gift:end","comment"]);expect(play).toHaveBeenCalledOnce();
 });
 it("allows at most two gifts so a ready comment cannot starve",async()=>{
  const priority=new GiftPriority(),queue=new EventQueue();for(const id of ["1","2","3"])queue.add(gift(id));
  const play=vi.fn(async()=>{});
  expect(await priority.during(Promise.resolve("comment"),new AbortController().signal,()=>queue.takeGift(),play)).toBe("comment");
  expect(play).toHaveBeenCalledTimes(2);expect(queue.take()?.id).toBe("3");
 });
 it("Stop releases a pending AI wait without starting another paid request",async()=>{
  const priority=new GiftPriority(),ai=deferred<string>(),controller=new AbortController(),play=vi.fn();
  const result=priority.during(ai.promise,controller.signal,()=>undefined,play);
  controller.abort();await expect(result).rejects.toThrow();expect(play).not.toHaveBeenCalled();
  ai.reject(new Error("late provider failure"));await flush();
 });
 it("retains an AI failure until gift playback finishes and propagates it once",async()=>{
  const priority=new GiftPriority(),queue=new EventQueue(),ai=deferred<string>(),playing=deferred<void>();queue.add(gift("1"));
  const result=priority.during(ai.promise,new AbortController().signal,()=>queue.takeGift(),()=>playing.promise);
  const checked=expect(result).rejects.toThrow("provider failed");ai.reject(new Error("provider failed"));await flush();playing.resolve();await checked;
 });
});
