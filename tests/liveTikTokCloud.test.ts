import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth",()=>({requireStudioUser:vi.fn()}));
vi.mock("@/lib/live/tiktok-session",()=>({claimTikTokSession:vi.fn()}));
vi.mock("@vercel/functions",()=>({experimental_upgradeWebSocket:vi.fn(async()=>new Response(null,{status:204}))}));
const upstream = vi.hoisted(()=>({connect:vi.fn(),disconnect:vi.fn(),created:vi.fn(),handlers:new Map<string,(data?:unknown)=>void>()}));
vi.mock("tiktok-live-connector",()=>({
  TikTokLiveConnection:class {constructor(...args:unknown[]){upstream.created(...args);}on(event:string,handler:(data?:unknown)=>void){upstream.handlers.set(event,handler);}connect=upstream.connect;disconnect=upstream.disconnect;},
  WebcastEvent:{CHAT:"chat",GIFT:"gift",FOLLOW:"follow",STREAM_END:"streamEnd"},ControlEvent:{DISCONNECTED:"disconnected",ERROR:"error"}
}));
import { requireStudioUser } from "@/lib/auth";
import { claimTikTokSession } from "@/lib/live/tiktok-session";
import { experimental_upgradeWebSocket } from "@vercel/functions";
import { serveTikTokSocket } from "@/lib/live/tiktok-cloud";
import { GET } from "@/app/api/live-studio/tiktok/route";
class Socket extends EventEmitter {
  readyState=1;bufferedAmount=0;sent:Record<string,unknown>[]=[];closeCode=0;
  send(value:string){this.sent.push(JSON.parse(value));}
  ping(){}
  close(code:number){this.closeCode=code;this.readyState=3;this.emit("close");}
  input(value:unknown){this.emit("message",Buffer.from(JSON.stringify(value)));}
}
const run=(s:Socket)=>serveTikTokSocket(s as unknown as Parameters<typeof serveTikTokSocket>[0],"owner");
const request=(origin="https://studio.example",upgrade="websocket")=>new NextRequest("https://studio.example/api/live-studio/tiktok",{headers:{origin,upgrade}});
describe("cloud TikTok connection",()=>{
  beforeEach(()=>{vi.clearAllMocks();upstream.handlers.clear();upstream.connect.mockResolvedValue({});upstream.disconnect.mockResolvedValue(undefined);vi.mocked(claimTikTokSession).mockResolvedValue(vi.fn().mockResolvedValue(undefined));vi.mocked(requireStudioUser).mockResolvedValue({id:"owner",email:"test@example.com",role:"studio"});});
  it("rejects unauthorized and cross-origin upgrades",async()=>{
    vi.mocked(requireStudioUser).mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("https://evil.example"))).status).toBe(403);
    expect(experimental_upgradeWebSocket).not.toHaveBeenCalled();
  });
  it("requires an upgrade after authentication",async()=>{expect((await GET(request("https://studio.example",""))).status).toBe(426);expect(experimental_upgradeWebSocket).not.toHaveBeenCalled();});
  it("probes the actual websocket without calling TikTok or claiming a session",async()=>{const s=new Socket();const done=run(s);s.input({type:"probe"});await done;expect(s.sent[0]).toMatchObject({type:"probe",ok:true});expect(upstream.created).not.toHaveBeenCalled();expect(claimTikTokSession).not.toHaveBeenCalled();});
  it("rejects invalid identifiers before connecting",async()=>{const s=new Socket();const done=run(s);s.input({type:"connect",username:"https://evil.example"});await done;expect(s.closeCode).toBe(1008);expect(upstream.created).not.toHaveBeenCalled();});
  it("prevents duplicate owner connections",async()=>{vi.mocked(claimTikTokSession).mockResolvedValue(null);const s=new Socket();const done=run(s);s.input({type:"connect",username:"test_user"});await done;expect(s.sent.at(-1)).toMatchObject({type:"status",terminal:true,connected:false});expect(upstream.created).not.toHaveBeenCalled();});
  it("forwards normalized events once per gift streak and closes upstream on stop",async()=>{
    const release=vi.fn().mockResolvedValue(undefined);vi.mocked(claimTikTokSession).mockResolvedValue(release);
    const s=new Socket();const done=run(s);s.input({type:"connect",username:"test_user"});
    await vi.waitFor(()=>expect(s.sent.some(e=>e.connected===true)).toBe(true));
    upstream.handlers.get("chat")?.({common:{msgId:"abc"},user:{nickname:"Anna"},comment:"Szia!"});
    upstream.handlers.get("gift")?.({giftDetails:{giftType:1,giftName:"Rose"},repeatEnd:false});
    expect(s.sent.filter(e=>e.type==="event")).toEqual([{type:"event",event:{id:"comment:abc",type:"comment",user:"Anna",text:"Szia!",count:1}}]);
    s.close(1000);await done;expect(upstream.disconnect).toHaveBeenCalledOnce();expect(release).toHaveBeenCalledOnce();
    expect(upstream.created.mock.calls[0][1]).toMatchObject({processInitialData:false});
  });
  it("treats upstream errors as terminal without reconnecting or generating replies",async()=>{
    const s=new Socket();const done=run(s);s.input({type:"connect",username:"test_user"});
    await vi.waitFor(()=>expect(upstream.connect).toHaveBeenCalledOnce());
    upstream.handlers.get("error")?.(new Error("Provider refused"));await done;
    expect(s.sent.at(-1)).toMatchObject({terminal:true,connected:false});expect(upstream.connect).toHaveBeenCalledOnce();
  });
});
