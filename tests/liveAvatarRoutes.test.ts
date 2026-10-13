import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireStudioUser: vi.fn() }));
vi.mock("@/lib/ai-video/storage", () => ({ R2VideoStore: vi.fn().mockImplementation(() => ({ readRecord: mocks.read, writeRecord: mocks.write })) }));
vi.mock("@/lib/live/avatar", async original => ({ ...await original<object>(), prepareAvatar: vi.fn(), createAvatar: vi.fn(), cancelAvatar: vi.fn(), retrieveAvatar: vi.fn() }));
import { requireStudioUser } from "@/lib/auth";
import { prepareAvatar, createAvatar, cancelAvatar } from "@/lib/live/avatar";
import { POST, GET, DELETE } from "@/app/api/live-studio/avatar/route";
const requestId = "595a7d59-51d0-44c8-a5fb-b5bd7f7b8280";
const sessionId = "baa672bd-4424-4732-ad14-55eb52bc81f7";
const req = (method: string, origin = "https://studio.example") => new NextRequest(`https://studio.example/api/live-studio/avatar?requestId=${requestId}`, { method, headers: { origin, "Content-Type": "application/json" }, ...(method === "GET" ? {} : { body: JSON.stringify({ requestId }) }) });
describe("Runway route ownership and cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.mocked(requireStudioUser).mockResolvedValue({ id: "owner", email: "test@example.com", role: "studio" });
    vi.mocked(prepareAvatar).mockResolvedValue({ avatarId: sessionId, signedUrl: "private" });
    vi.mocked(createAvatar).mockResolvedValue(sessionId); mocks.write.mockResolvedValue(true);
  });
  it("rejects anonymous or cross-origin creation before provider work", async () => {
    expect((await POST(req("POST", "https://elsewhere.example"))).status).toBe(403);
    vi.mocked(requireStudioUser).mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(req("POST"))).status).toBe(401); expect(prepareAvatar).not.toHaveBeenCalled();
  });
  it("deduplicates paid creation through conditional storage", async () => {
    mocks.write.mockResolvedValue(false);
    expect((await POST(req("POST"))).status).toBe(409); expect(createAvatar).not.toHaveBeenCalled();
  });
  it("cancels a worker when stop raced creation", async () => {
    mocks.read.mockResolvedValue({ value: { requestId, state: "cancel_requested" }, etag: "v2" });
    expect((await POST(req("POST"))).status).toBe(409); expect(cancelAvatar).toHaveBeenCalledWith(sessionId);
  });
  it("cancels a worker when the session ID cannot be persisted", async () => {
    mocks.read.mockResolvedValue({ value: { requestId, state: "creating" }, etag: "v1" });
    mocks.write.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error("storage failure"));
    expect((await POST(req("POST"))).status).toBe(503); expect(cancelAvatar).toHaveBeenCalledWith(sessionId);
  });
  it("does not expose another user's unowned session and cancels only stored IDs", async () => {
    mocks.read.mockResolvedValue(null);
    expect((await GET(req("GET"))).status).toBe(404);
    expect((await DELETE(req("DELETE"))).status).toBe(200); expect(cancelAvatar).not.toHaveBeenCalled();
    expect(mocks.write).toHaveBeenCalledWith("live-avatar", requestId, expect.objectContaining({ state: "cancel_requested" }));
  });
});
