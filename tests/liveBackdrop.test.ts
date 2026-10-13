import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { R2VideoStore } from "@/lib/ai-video/storage";
vi.mock("@/lib/budget", () => ({ getProductionBudget: vi.fn(), reserveProductionBudget: vi.fn() }));
vi.mock("@/lib/live/motion", () => ({ retrieveMotion: vi.fn() }));
vi.mock("@/lib/ai-video/media", () => ({ downloadProviderMedia: vi.fn() }));
import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { downloadProviderMedia } from "@/lib/ai-video/media";
import { retrieveMotion } from "@/lib/live/motion";
import { startBackdrop, readBackdrop, BACKDROP_ID, type BackdropRecord } from "@/lib/live/backdrop";
const taskId = "baa672bd-4424-4732-ad14-55eb52bc81f7";
let value: BackdropRecord | null;
const store = { readRecord: vi.fn(async () => value ? { value, etag: "v1" } : null), writeRecord: vi.fn(async (_kind, _id, record) => { value = record; return true; }), putAsset: vi.fn() };
const typedStore = store as unknown as R2VideoStore;
describe("Persistent continuous backdrop", () => {
  beforeEach(() => {
    vi.clearAllMocks();value = null;vi.stubEnv("RUNWAYML_API_SECRET", "test");
    vi.mocked(getProductionBudget).mockResolvedValue({ daily_limit_usd: 10, timezone: "UTC", budget_day: "2026-10-14", reserved_usd: 0, remaining_usd: 10, provider_billing_cap_verified: true, configured_services: { runway_backdrop_5s: 1 } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: taskId }))));
  });
  afterEach(() => { vi.unstubAllGlobals();vi.unstubAllEnvs(); });
  it("generates once, with a bounded portrait payload, then reuses the same task", async () => {
    await startBackdrop(typedStore);await startBackdrop(typedStore);
    expect(fetch).toHaveBeenCalledTimes(1);expect(reserveProductionBudget).toHaveBeenCalledTimes(1);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ model: "gen4.5", duration: 5, ratio: "720:1280" });
    expect(store.writeRecord).toHaveBeenCalledWith("live-backdrop", BACKDROP_ID, expect.objectContaining({ status: "SUBMITTING" }));
  });
  it("blocks an unverified price ceiling before reserving or submitting", async () => {
    vi.mocked(getProductionBudget).mockResolvedValue({ daily_limit_usd: 10, timezone: "UTC", budget_day: "2026-10-14", reserved_usd: 0, remaining_usd: 10, provider_billing_cap_verified: true, configured_services: { runway_backdrop_5s: 0.1 } });
    await expect(startBackdrop(typedStore)).rejects.toThrow("BACKDROP_BUDGET_NOT_CONFIGURED");
    expect(reserveProductionBudget).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });
  it("a lost creation claim never starts a second provider job", async () => {
    store.writeRecord.mockImplementationOnce(async () => { value = { status: "PENDING", createdAt: "now", taskId };return false; });
    expect((await startBackdrop(typedStore)).status).toBe("PENDING");
    expect(fetch).not.toHaveBeenCalled();expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it("an ambiguous submit remains blocked on subsequent starts", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));
    await expect(startBackdrop(typedStore)).rejects.toThrow("network");
    expect((await startBackdrop(typedStore)).status).toBe("UNCERTAIN");expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("archives the completed loop and never polls or regenerates it again", async () => {
    value = { status: "PENDING", createdAt: "now", taskId };
    vi.mocked(retrieveMotion).mockResolvedValue({ status: "SUCCEEDED", url: "https://example.cloudfront.net/video.mp4" });
    const bytes = Buffer.alloc(128);bytes.write("ftyp",4);vi.mocked(downloadProviderMedia).mockResolvedValue(bytes);
    const first = await readBackdrop(typedStore);const second = await readBackdrop(typedStore);
    expect(first).toEqual(second);expect(first.url).toMatch(/^\/api\/ai-video\/assets\/[a-f0-9]{64}$/);
    expect(store.putAsset).toHaveBeenCalledTimes(1);expect(retrieveMotion).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();
  });
});
