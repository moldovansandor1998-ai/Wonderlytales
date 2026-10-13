import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), list:vi.fn(), putAsset:vi.fn(), download:vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireStudioUser: vi.fn() }));
vi.mock("@/lib/ai-video/storage", () => ({ digest:()=>"a".repeat(64), R2VideoStore: vi.fn().mockImplementation(() => ({ readRecord: mocks.read, writeRecord: mocks.write, listRecords:mocks.list,putAsset:mocks.putAsset })) }));
vi.mock("@/lib/ai-video/media",()=>({downloadProviderMedia:mocks.download}));
vi.mock("@/lib/live/motion", async original => ({ ...await original<object>(), prepareMotion: vi.fn(), createMotion: vi.fn(), cancelMotion: vi.fn(), retrieveMotion: vi.fn(), motionSpeech: vi.fn() }));
import { requireStudioUser } from "@/lib/auth";
import { prepareMotion, createMotion, cancelMotion, motionSpeech, retrieveMotion } from "@/lib/live/motion";
import { POST, GET, DELETE } from "@/app/api/live-studio/motion/route";
const requestId = "595a7d59-51d0-44c8-a5fb-b5bd7f7b8280";
const taskId = "baa672bd-4424-4732-ad14-55eb52bc81f7";
const req = (method: string, origin = "https://studio.example") => new NextRequest(`https://studio.example/api/live-studio/motion?requestId=${requestId}`, { method, headers: { origin, "Content-Type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify(method === "POST" ? { requestId, speaker:"isti",text:"Próba",voiceId:"voice" } : {requestId}) }) });
describe("Runway route ownership and cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(requireStudioUser).mockResolvedValue({ id: "owner", email: "test@example.com", role: "studio" });
    vi.mocked(prepareMotion).mockResolvedValue(taskId); vi.mocked(motionSpeech).mockResolvedValue(Buffer.from("wave"));
    vi.mocked(createMotion).mockResolvedValue(taskId); mocks.write.mockResolvedValue(true);
  });
  it("rejects anonymous or cross-origin creation before provider work", async () => {
    expect((await POST(req("POST", "https://elsewhere.example"))).status).toBe(403);
    vi.mocked(requireStudioUser).mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(req("POST"))).status).toBe(401); expect(prepareMotion).not.toHaveBeenCalled();
  });
  it("deduplicates paid creation through conditional storage", async () => {
    mocks.write.mockResolvedValue(false);
    expect((await POST(req("POST"))).status).toBe(409); expect(createMotion).not.toHaveBeenCalled();
  });
  it("cancels a worker when stop raced creation", async () => {
    mocks.read.mockResolvedValueOnce({ value: { requestId, state: "creating" }, etag: "v1" }).mockResolvedValueOnce({ value: { requestId, state: "cancel_requested" }, etag: "v2" });
    expect((await POST(req("POST"))).status).toBe(409); expect(cancelMotion).toHaveBeenCalledWith(taskId);
  });
  it("cancels a worker when the session ID cannot be persisted", async () => {
    mocks.read.mockResolvedValue({ value: { requestId, state: "creating" }, etag: "v1" });
    mocks.write.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("storage failure"));
    expect((await POST(req("POST"))).status).toBe(503); expect(cancelMotion).toHaveBeenCalledWith(taskId);
  });
  it("does not expose another user's unowned session and cancels only stored IDs", async () => {
    mocks.read.mockResolvedValue(null);
    expect((await GET(req("GET"))).status).toBe(404);
    expect((await DELETE(req("DELETE"))).status).toBe(200); expect(cancelMotion).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledWith("live-motion", requestId, expect.objectContaining({ state: "cancel_requested" }));
  });
  it("replays stored media without provider calls or another charge",async()=>{
    mocks.read.mockResolvedValue({value:{state:"active",assetId:"a".repeat(64)},etag:"v1"});
    const response=await GET(req("GET"));
    expect(await response.json()).toEqual({status:"SUCCEEDED",url:"/api/ai-video/assets/"+"a".repeat(64),archived:true});
    expect(retrieveMotion).not.toHaveBeenCalled();expect(createMotion).not.toHaveBeenCalled();expect(motionSpeech).not.toHaveBeenCalled();
  });
  it("saves completed video bytes in the gallery before returning the durable URL",async()=>{
    mocks.read.mockResolvedValue({value:{requestId,state:"active",taskId},etag:"v1"});
    vi.mocked(retrieveMotion).mockResolvedValue({status:"SUCCEEDED",url:"https://example.cloudfront.net/clip.mp4"});
    const bytes=Buffer.alloc(128);bytes.write("ftyp",4);mocks.download.mockResolvedValue(bytes);
    const response=await GET(req("GET"));
    expect((await response.json()).archived).toBe(true);
    expect(mocks.putAsset).toHaveBeenCalledWith("a".repeat(64),"mp4",bytes);
    expect(mocks.write).toHaveBeenCalledWith("live-motion",requestId,expect.objectContaining({assetId:"a".repeat(64)}),"v1");
    expect(createMotion).not.toHaveBeenCalled();expect(motionSpeech).not.toHaveBeenCalled();
  });
  it("does not mark an unsuccessful media transfer as saved or regenerate the clip",async()=>{
    mocks.read.mockResolvedValue({value:{state:"active",taskId},etag:"v1"});
    vi.mocked(retrieveMotion).mockResolvedValue({status:"SUCCEEDED",url:"https://example.cloudfront.net/clip.mp4"});
    mocks.download.mockRejectedValue(new Error("download failed"));
    const response=await GET(req("GET"));
    expect((await response.json()).archived).toBe(false);expect(mocks.putAsset).not.toHaveBeenCalled();expect(createMotion).not.toHaveBeenCalled();
  });
  it("lists only owned active request IDs, without provider task identifiers",async()=>{
    mocks.list.mockResolvedValue([{requestId,state:"active",taskId,createdAt:"2026-10-14",speaker:"ali",text:"Szia!"},{requestId:"stopped",state:"ended",taskId,createdAt:"2026-10-13"}]);
    const response=await GET(new NextRequest("https://studio.example/api/live-studio/motion?recent=1"));
    expect(await response.json()).toEqual({clips:[{requestId,createdAt:"2026-10-14",speaker:"ali",text:"Szia!"}]});
    expect(retrieveMotion).not.toHaveBeenCalled();expect(createMotion).not.toHaveBeenCalled();
  });
});
