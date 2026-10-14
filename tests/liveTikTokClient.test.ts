import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
const hooks=vi.hoisted(()=>({cleanups:[] as (()=>void)[]}));
// Exercise the actual socket callbacks and timers; no React rendering is needed.
vi.mock("react",()=>({
  useRef:(value:unknown)=>({current:value}),
  useState:(value:unknown)=>[value,vi.fn()],
  useEffect:(effect:()=>()=>void)=>{hooks.cleanups.push(effect());},
}));
import {useTikTokConnection} from "@/app/live-studio/useTikTokConnection";
class Socket {
  static instances:Socket[]=[];
  onopen?:()=>void;onmessage?:(data:{data:string})=>void;onclose?:(event:{code:number})=>void;onerror?:()=>void;
  send=vi.fn();
  constructor(_url:string){Socket.instances.push(this);}
  close(code=1000){this.onclose?.({code});}
  receive(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}
}
describe("TikTok client resumes without disabling the reply queue",()=>{
  beforeEach(()=>{vi.useFakeTimers();Socket.instances=[];vi.stubGlobal("WebSocket",Socket);vi.stubGlobal("location",{protocol:"https:",host:"studio.example"});});
  afterEach(()=>{hooks.cleanups.splice(0).forEach(cleanup=>cleanup());vi.useRealTimers();vi.unstubAllGlobals();});
  it("keeps auto replies enabled across suspension, temporary offline, and eventual comment/gift arrival",async()=>{
    const event=vi.fn(),terminal=vi.fn();const client=useTikTokConnection(event,terminal);
    client.connect("cloud","test_user","");const first=Socket.instances[0];
    first.receive({type:"status",connected:true});
    first.receive({type:"status",connected:false,terminal:false,code:"TIKTOK_SUSPENDED"});first.close(1012);
    await vi.advanceTimersByTimeAsync(5000);const second=Socket.instances[1];
    second.receive({type:"status",connected:false,terminal:true,code:"TIKTOK_OFFLINE"});second.close();
    expect(terminal).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(10000);
    const resumed=Socket.instances[2];resumed.receive({type:"status",connected:true});
    resumed.receive({type:"event",event:{id:"c",type:"comment",user:"Teszt",text:"Hallotok?"}});
    resumed.receive({type:"event",event:{id:"g",type:"gift",user:"Teszt",gift:"Rose",giftValue:1}});
    expect(event.mock.calls.map(([value])=>value.type)).toEqual(["comment","gift"]);
    expect(terminal).not.toHaveBeenCalled();client.disconnect();
    await vi.advanceTimersByTimeAsync(120000);expect(Socket.instances).toHaveLength(3);
  });
  it("stops actual end and initial offline without reconnecting",async()=>{
    for(const code of ["TIKTOK_OFFLINE","TIKTOK_ENDED"]){
      const terminal=vi.fn();const client=useTikTokConnection(vi.fn(),terminal);client.connect("cloud","test_user","");
      const s=Socket.instances.at(-1)!;s.receive({type:"status",connected:false,terminal:true,code,message:"Stopped"});s.close();
      const count=Socket.instances.length;await vi.advanceTimersByTimeAsync(120000);
      expect(terminal).toHaveBeenCalledOnce();expect(Socket.instances).toHaveLength(count);client.disconnect();
    }
  });
  it("cancels a scheduled reconnect when the operator presses stop",async()=>{
    const terminal=vi.fn();const client=useTikTokConnection(vi.fn(),terminal);client.connect("cloud","test_user","");
    const s=Socket.instances[0];s.receive({type:"status",connected:true});s.close(1012);client.disconnect();
    await vi.advanceTimersByTimeAsync(120000);expect(Socket.instances).toHaveLength(1);expect(terminal).not.toHaveBeenCalled();
  });
});
