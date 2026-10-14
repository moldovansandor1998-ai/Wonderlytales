import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {isMusicGift} from "@/lib/live/npc-shared";
import {eventSchema,EventQueue} from "@/lib/live/events";
import {normalizeEvent} from "../tools/tiktok-bridge/normalize.mjs";
vi.mock("@/lib/budget",()=>({getProductionBudget:vi.fn(),reserveProductionBudget:vi.fn()}));
vi.mock("@/lib/live/motion",()=>({retrieveMotion:vi.fn()}));
import {getProductionBudget,reserveProductionBudget} from "@/lib/budget";
import {startNpcClip,startNpcVoice,npcPayload,readNpc} from "@/lib/live/npc";
import {imageMetadata} from "@/lib/ai-video/storage";
import {readFileSync} from "node:fs";
const event={id:"1",type:"gift" as const,user:"Néző",text:"",gift:"Zene",count:1};
describe("music gifts",()=>{
 it("requires a real gift and exact configured name or ID",()=>{
  expect(isMusicGift(event)).toBe(true);
  expect(isMusicGift({...event,type:"comment",text:"Zene"})).toBe(false);
  expect(isMusicGift({...event,gift:"Zene máshol"})).toBe(false);
  expect(isMusicGift({...event,gift:"Different locale",giftId:"123"},"Zene","123")).toBe(true);
  expect(isMusicGift({...event,giftId:"124"},"Zene","123")).toBe(false);
 });
 it("preserves native gift IDs, waits for streak completion, and deduplicates reactions",()=>{
  const data={common:{msgId:"112233"},giftId:123,gift:{name:"Music Note",type:1},repeatEnd:0,repeatCount:4,user:{nickname:"Néző"}};
  expect(normalizeEvent("gift",data)).toBeNull();data.repeatEnd=1;
  const normalized=eventSchema.parse(normalizeEvent("gift",data));expect(normalized.giftId).toBe("123");
  const queue=new EventQueue();expect(queue.add(normalized)).toBe(true);expect(queue.add(normalized)).toBe(false);
  expect(isMusicGift(queue.take()!,"","123")).toBe(true);expect(queue.take()).toBeUndefined();
 });
});
describe("bounded saved NPC assets",()=>{
 const records=new Map<string,{value:any;etag:string}>();
 const store={readRecord:vi.fn(async(_kind:string,id:string)=>records.get(id)||null),writeRecord:vi.fn(async(_kind:string,id:string,value:any,etag?:string)=>{if(!etag&&records.has(id))return false;records.set(id,{value,etag:"v1"});return true;}),putAsset:vi.fn(),putChunk:vi.fn(),completeImage:vi.fn()};
 beforeEach(()=>{vi.clearAllMocks();records.clear();vi.stubEnv("RUNWAYML_API_SECRET","test");vi.stubEnv("ELEVENLABS_API_KEY","test");vi.mocked(getProductionBudget).mockResolvedValue({configured_services:{runway_npc_8s:0.8}} as any);vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({id:"a1111111-1111-4111-8111-111111111111"}))));});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it("uses the same first and last frames, 8 seconds, and no generated audio",()=>{
  for(const kind of ["idle-breathe","idle-glance","idle-shrug","music-gift"] as const){const payload=npcPayload(kind,"data:image/webp;base64,test");expect(payload).toMatchObject({model:"veo3.1_fast",duration:8,audio:false,ratio:"720:1280"});expect(payload.promptImage[0].uri).toBe(payload.promptImage[1].uri);expect(payload.promptText.length).toBeLessThanOrEqual(1000);}
 });
 it("submits each fixed clip once and preserves the source in the gallery",async()=>{
  await startNpcClip(store,"idle-breathe");await startNpcClip(store,"idle-breathe");expect(fetch).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledWith("runway_npc_8s");expect(store.completeImage).toHaveBeenCalledTimes(1);
 });
 it("blocks missing budget and never resubmits ambiguous paid jobs",async()=>{
  vi.mocked(getProductionBudget).mockResolvedValueOnce({configured_services:{}} as any);await expect(startNpcClip(store,"idle-glance")).rejects.toThrow("NPC_BUDGET");expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));await expect(startNpcClip(store,"idle-glance")).rejects.toThrow("network");expect((await startNpcClip(store,"idle-glance")).status).toBe("UNCERTAIN");expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("saves the fixed shout once per selected voice and reuses it",async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array(200)));
  await startNpcVoice(store,"IstiVoice");await startNpcVoice(store,"IstiVoice");expect(fetch).toHaveBeenCalledTimes(1);expect(store.putAsset).toHaveBeenCalledTimes(1);
  const manifest=await readNpc(store,"IstiVoice");expect(manifest.voice.url).toMatch(/type=mp3$/);expect(manifest.ready).toBe(false);
 });
 it("recognizes the generated WebP reference for private gallery storage",()=>{expect(imageMetadata(readFileSync("public/live-studio/ali-isti-masked.webp"))).toMatchObject({mime:"image/webp",width:941,height:1672});});
});
