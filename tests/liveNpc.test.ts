import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {isMusicGift,BASIC_GAGS,GAG_KINDS,GAG_META} from "@/lib/live/npc-shared";
import {eventSchema,EventQueue} from "@/lib/live/events";
import {normalizeEvent} from "../tools/tiktok-bridge/normalize.mjs";
vi.mock("@/lib/budget",()=>({getProductionBudget:vi.fn(),reserveProductionBudget:vi.fn()}));
vi.mock("@/lib/live/motion",()=>({retrieveMotion:vi.fn()}));
import {getProductionBudget,reserveProductionBudget} from "@/lib/budget";
import {startNpcClip,startNpcVoice,npcPayload,reactionPayload,readNpc,npcRecordId,activateNpcGalaxy,GALAXY_REVISION_ID} from "@/lib/live/npc";
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
 const store={readRecord:vi.fn(async(_kind:string,id:string)=>records.get(id)||null),writeRecord:vi.fn(async(_kind:string,id:string,value:any,etag?:string)=>{const old=records.get(id);if(etag?old?.etag!==etag:!!old)return false;records.set(id,{value,etag:String(Number(old?.etag||0)+1)});return true;}),assetBytes:vi.fn(),putAsset:vi.fn(),putChunk:vi.fn(),completeImage:vi.fn()};
 beforeEach(()=>{vi.clearAllMocks();records.clear();vi.stubEnv("RUNWAYML_API_SECRET","test");vi.stubEnv("ELEVENLABS_API_KEY","test");vi.mocked(getProductionBudget).mockResolvedValue({configured_services:{runway_npc_8s:0.8,runway_npc_4s:0.4}} as any);vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({id:"a1111111-1111-4111-8111-111111111111"}))));});
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
 it("uses the same first and last frames, 8 seconds, and no generated audio",()=>{
  for(const kind of ["idle-breathe","idle-glance","idle-shrug","music-gift"] as const){const payload=npcPayload(kind,"data:image/webp;base64,test");expect(payload).toMatchObject({model:"veo3.1_fast",duration:8,audio:false,ratio:"720:1280"});expect(payload.promptImage[0].uri).toBe(payload.promptImage[1].uri);expect(payload.promptText.length).toBeLessThanOrEqual(1000);}
 });
 it("saves six distinct four-second gags once each using the existing bounded budget",async()=>{
  for(const kind of BASIC_GAGS){
    const payload=npcPayload(kind,"frame");expect(payload.duration).toBe(4);expect(payload.promptText.length).toBeLessThanOrEqual(1000);
    await startNpcClip(store,kind);await startNpcClip(store,kind);
  }
  expect(fetch).toHaveBeenCalledTimes(6);expect(reserveProductionBudget).toHaveBeenCalledWith("runway_npc_4s");
 });
 it("plays gags forward without a forced reset and uses distinct, valid versioned storage slots",()=>{
  for(const kind of GAG_KINDS){const payload=npcPayload(kind,"frame");expect(payload.promptImage).toEqual([{uri:"frame",position:"first"}]);expect(payload.duration).toBe(GAG_META[kind].duration);expect(payload.promptText.length).toBeLessThanOrEqual(1000);expect(npcRecordId(kind)).toMatch(/^[a-f0-9-]{36}$/);}
  expect(new Set(GAG_KINDS.map(npcRecordId)).size).toBe(GAG_KINDS.length);
  expect(npcRecordId("idle-breathe")).toBe("00000000-0000-4000-8001-000000000001");
  expect(npcRecordId("gag-mud")).not.toBe("00000000-0000-4000-8001-000000000005");
 });
 it("submits each fixed clip once and preserves the source in the gallery",async()=>{
  await startNpcClip(store,"idle-breathe");await startNpcClip(store,"idle-breathe");expect(fetch).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledWith("runway_npc_8s");expect(store.completeImage).toHaveBeenCalledTimes(1);
 });
 it("blocks missing budget and never resubmits ambiguous paid jobs",async()=>{
  vi.mocked(getProductionBudget).mockResolvedValueOnce({configured_services:{}} as any);await expect(startNpcClip(store,"idle-glance")).rejects.toThrow("NPC_BUDGET");expect(fetch).not.toHaveBeenCalled();
  vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));await expect(startNpcClip(store,"idle-glance")).rejects.toThrow("network");expect((await startNpcClip(store,"idle-glance")).status).toBe("UNCERTAIN");expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("records definitive provider rejections and permits only one explicit bounded retry",async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({error:"Too many concurrent tasks"}),{status:429}));
  await expect(startNpcClip(store,"gag-bubble")).rejects.toThrow("NPC_CAPACITY_LIMIT");
  expect((await startNpcClip(store,"gag-bubble")).status).toBe("FAILED");expect(fetch).toHaveBeenCalledTimes(1);
  await startNpcClip(store,"gag-bubble",true);expect(fetch).toHaveBeenCalledTimes(2);
  await expect(startNpcClip(store,"gag-bubble",true)).rejects.toThrow("NPC_RETRY_NOT_ALLOWED");
  expect(fetch).toHaveBeenCalledTimes(2);
 });
 it("saves the fixed shout once per selected voice and reuses it",async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array(200)));
  await startNpcVoice(store,"IstiVoice");await startNpcVoice(store,"IstiVoice");expect(fetch).toHaveBeenCalledTimes(1);expect(store.putAsset).toHaveBeenCalledTimes(1);
  const manifest=await readNpc(store,"IstiVoice");expect(manifest.voice.url).toMatch(/type=mp3$/);expect(manifest.ready).toBe(false);
 });
 it("recovers a definitively rejected credit request once after a top-up, including concurrent clicks",async()=>{
  const rejected={status:"FAILED",createdAt:"before",attempts:2,providerStatus:400,error:"NPC_CREDITS_REQUIRED",previousAttempt:{status:"FAILED",createdAt:"first",providerStatus:429}};
  records.set(npcRecordId("gag-bubble"),{value:rejected,etag:"1"});
  const before=await readNpc(store,"IstiVoice");expect(before.clips.find(c=>c.kind==="gag-bubble")).toMatchObject({creditRecoveryAllowed:true});
  await Promise.all([startNpcClip(store,"gag-bubble",false,{recoverCredit:true}),startNpcClip(store,"gag-bubble",false,{recoverCredit:true})]);
  expect(fetch).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);
  const value=records.get(npcRecordId("gag-bubble"))!.value;
  expect(value).toMatchObject({status:"PENDING",creditRecoveryUsed:true,attempts:3,previousAttempt:rejected});
  await expect(startNpcClip(store,"gag-bubble",false,{recoverCredit:true})).rejects.toThrow("NPC_RETRY_NOT_ALLOWED");
 });
 it.each([
  {status:"UNCERTAIN",providerStatus:503},
  {status:"PENDING",taskId:"already-running"},
  {status:"FAILED",providerStatus:400,taskId:"already-submitted"},
  {status:"FAILED",providerStatus:400,creditRecoveryUsed:true},
  {status:"FAILED",providerStatus:429,error:"NPC_CAPACITY_LIMIT"},
 ])("never uses credit recovery to resubmit an ambiguous, paid, or recovered task: %j",async fields=>{
  records.set(npcRecordId("gag-bubble"),{value:{createdAt:"before",error:"NPC_CREDITS_REQUIRED",attempts:2,...fields},etag:"1"});
  await expect(startNpcClip(store,"gag-bubble",false,{recoverCredit:true})).rejects.toThrow("NPC_RETRY_NOT_ALLOWED");expect(fetch).not.toHaveBeenCalled();expect(reserveProductionBudget).not.toHaveBeenCalled();
 });
 it("keeps the original Galaxy active until a completed revision is explicitly selected",async()=>{
  const original={status:"SUCCEEDED",createdAt:"before",assetId:"original"};
  records.set(npcRecordId("gag-galaxy"),{value:original,etag:"1"});
  await startNpcClip(store,"gag-galaxy",false,{galaxyRevision:true});await startNpcClip(store,"gag-galaxy",false,{galaxyRevision:true});
  expect(fetch).toHaveBeenCalledTimes(1);expect(npcPayload("gag-galaxy","frame",true).promptText.length).toBeLessThanOrEqual(1000);
  await expect(activateNpcGalaxy(store)).rejects.toThrow("NPC_REVISION_NOT_READY");
  records.set(GALAXY_REVISION_ID,{value:{status:"SUCCEEDED",createdAt:"now",assetId:"revised"},etag:"3"});
  let manifest=await readNpc(store,"IstiVoice");expect(manifest.clips.find(c=>c.kind==="gag-galaxy")?.url).toContain("original");
  expect(manifest.galaxyRevision).toMatchObject({status:"SUCCEEDED",approved:false});
  await activateNpcGalaxy(store);await activateNpcGalaxy(store);
  manifest=await readNpc(store,"IstiVoice");expect(manifest.clips.find(c=>c.kind==="gag-galaxy")?.url).toContain("revised");expect(records.get(npcRecordId("gag-galaxy"))!.value).toEqual(original);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it("pins the rise, standing gesture and sit to explicit keyframes, with no duplicate submissions",async()=>{
  const rise=reactionPayload(0,"seated","standing"),stand=reactionPayload(1,"seated","standing"),sit=reactionPayload(2,"seated","standing");
  expect(rise.promptImage.map(x=>x.uri)).toEqual(["seated","standing"]);expect(stand.promptImage.map(x=>x.uri)).toEqual(["standing","standing"]);expect(sit.promptImage.map(x=>x.uri)).toEqual(["standing","seated"]);
  for(const payload of [rise,stand,sit]){expect(payload.duration).toBe(4);expect(payload.audio).toBe(false);expect(payload.promptText.length).toBeLessThanOrEqual(1000);}
  await startNpcClip(store,"music-gift");await startNpcClip(store,"music-gift");expect(fetch).toHaveBeenCalledTimes(3);expect(reserveProductionBudget).toHaveBeenCalledTimes(3);
 });
 it("recognizes the generated WebP reference for private gallery storage",()=>{expect(imageMetadata(readFileSync("public/live-studio/ali-isti-masked.webp"))).toMatchObject({mime:"image/webp",width:941,height:1672});});
});
