import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), from: vi.fn(), exists: vi.fn(), get: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getStudioUser: mocks.user, createServerSupabase: () => ({ from: mocks.from }) }));
vi.mock("@/lib/providers/storage", () => ({ getStorage: () => ({ exists: mocks.exists, get: mocks.get, signedUrl: mocks.sign }) }));
import { GET } from "@/app/api/authoring/draft/[character]/route";

const hash = "a".repeat(64);
const key = `assets/characters/CHAR_MARK/drafts/V005/${hash}.glb`;
function records(objectKey = key, status = "DRAFT_UNRIGGED") {
  const rows = [{ id: "character" }, { model_asset_id: "asset", status: "DRAFT" },
    { object_key: objectKey, sha256: hash, kind: "CHARACTER_MODEL", metadata: { status } }];
  mocks.from.mockImplementation(() => {
    const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    chain.single.mockResolvedValue({ data: rows.shift() }); return chain;
  });
}
const request = () => GET(new Request("https://studio.example/api/authoring/draft/CHAR_MARK"), { params: { character: "CHAR_MARK" } });
describe("Private draft downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.user.mockResolvedValue({ role: "admin" });
    mocks.exists.mockResolvedValue(true); mocks.get.mockResolvedValue(Buffer.from("private-glb-bytes")); mocks.sign.mockResolvedValue("https://storage.example/draft.glb"); records();
  });
  it("denies anonymous requests before accessing the bucket", async () => {
    mocks.user.mockResolvedValue(null); expect((await request()).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("denies viewer access", async () => {
    mocks.user.mockResolvedValue({ role: "viewer" }); expect((await request()).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects a record pointing outside the character draft prefix", async () => {
    records("private/credentials.json"); expect((await request()).status).toBe(409);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not serve a falsely approved or unrelated record", async () => {
    records(key, "LOCKED"); expect((await request()).status).toBe(409);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("streams private model bytes as an uncached download", async () => {
    const response = await request(); expect(response.status).toBe(200);
    expect(mocks.exists).toHaveBeenCalledWith(key); expect(mocks.get).toHaveBeenCalledWith(key); expect(mocks.sign).not.toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toBe("model/gltf-binary");
    expect(response.headers.get("Content-Disposition")).toContain("CHAR_MARK_V005_UNRIGGED_DRAFT.glb");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("private-glb-bytes");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("reports an unavailable private object without a misleading download", async () => {
    mocks.get.mockRejectedValueOnce(new Error("storage unavailable"));
    expect((await request()).status).toBe(503);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not issue a signed link for a missing object", async () => {
    mocks.exists.mockResolvedValue(false); expect((await request()).status).toBe(404);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
