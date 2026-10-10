import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RunwayBenchmark, runwayTrialPayload, type TrialStore, type TrialCheckpoint, type RunwayTrialRequest } from "@/lib/providers/runway-benchmark";
import { RemoteGenVideo, MockGenVideo, getGenVideoProvider } from "@/lib/providers/genvideo";

function memoryStore(): TrialStore {
  const states = new Map<string, TrialCheckpoint>(); const claims = new Set<string>();
  return {
    async read(id) { return states.has(id) ? structuredClone(states.get(id)!) : null; },
    async claim(id, state) { if (claims.has(id)) return false; claims.add(id); states.set(id, structuredClone(state)); return true; },
    async save(id, state) { states.set(id, structuredClone(state)); },
  };
}
const req: RunwayTrialRequest = { revisionId: "B_SH01_r1", prompt: "Two retained characters walk and stop.",
  durationSec: 8, seed: 42, maxCostUsd: 6,
  images: [{ uri: "https://example.test/mark.png", sha256: "a".repeat(64) }, { uri: "https://example.test/lili.png", sha256: "b".repeat(64) }] };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
describe("Runway benchmark paid-job boundary", () => {
  let fetch: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetch = vi.fn(); vi.stubGlobal("fetch", fetch); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
  it("builds documented native-1080p references with a fixed cost and no pretend identity lock", () => {
    const p = runwayTrialPayload(req);
    expect(p.estimate).toBe(5.44); expect(p.body.ratio).toBe("1920:1080");
    expect(p.body.promptImage).toHaveLength(2); expect(p.body).not.toHaveProperty("locked_character_ids");
    expect(() => runwayTrialPayload({ ...req, maxCostUsd: 5 })).toThrow("költségplafont");
    expect(() => runwayTrialPayload({ ...req, durationSec: Number.NaN })).toThrow();
  });
  it("reserves before exactly one POST; resume reads stored task without a second charge", async () => {
    const store = memoryStore(); const reserve = vi.fn().mockResolvedValue(undefined);
    fetch.mockImplementation(() => { expect(reserve).toHaveBeenCalledWith(5.44); return Promise.resolve(response({ id: "task-123" })); });
    const provider = new RunwayBenchmark("test", store, reserve);
    expect((await provider.submit(req)).taskId).toBe("task-123");
    await provider.submit(req);
    expect(fetch).toHaveBeenCalledTimes(1); expect(reserve).toHaveBeenCalledTimes(1);
    const [url, args] = fetch.mock.calls[0]; expect(url).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    expect(args.headers["X-Runway-Version"]).toBe("2024-11-06");
    expect(JSON.parse(args.body).model).toBe("seedance2_5");
  });
  it("never repeats a lost POST response, including after process restart", async () => {
    const store = memoryStore(); const reserve = vi.fn().mockResolvedValue(undefined);
    fetch.mockRejectedValue(new Error("connection reset after send"));
    await expect(new RunwayBenchmark("test", store, reserve).submit(req)).rejects.toThrow("SUBMISSION_UNCERTAIN");
    expect((await new RunwayBenchmark("test", store, reserve).submit(req)).status).toBe("SUBMISSION_UNCERTAIN");
    expect(fetch).toHaveBeenCalledTimes(1); expect(reserve).toHaveBeenCalledTimes(1);
  });
  it("concurrent submissions share one permanent claim", async () => {
    const store = memoryStore(); const reserve = vi.fn().mockResolvedValue(undefined);
    fetch.mockResolvedValue(response({ id: "task-123" }));
    const p = new RunwayBenchmark("test", store, reserve);
    await Promise.all([p.submit(req), p.submit(req)]);
    expect(fetch).toHaveBeenCalledTimes(1); expect(reserve).toHaveBeenCalledTimes(1);
  });
  it("budget refusal submits nothing and records the blocked state", async () => {
    const store = memoryStore(); const p = new RunwayBenchmark("test", store, async () => { throw new Error("budget unavailable"); });
    await expect(p.submit(req)).rejects.toThrow("budget unavailable");
    expect((await store.read(req.revisionId))?.status).toBe("BLOCKED_BUDGET"); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects revision replacement but accepts refreshed signed URLs for identical hashes", async () => {
    fetch.mockResolvedValue(response({ id: "task-123" }));
    const p = new RunwayBenchmark("test", memoryStore(), async () => {});
    await p.submit(req);
    await expect(p.submit({ ...req, prompt: "different action" })).rejects.toThrow("nem írható felül");
    await p.submit({ ...req, images: req.images.map(x => ({ ...x, uri: x.uri + "?new-signature" })) });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("polls a completed task without promoting it to verified media or professional approval", async () => {
    const store = memoryStore(); const reserve = vi.fn().mockResolvedValue(undefined);
    const p = new RunwayBenchmark("test", store, reserve);
    fetch.mockResolvedValueOnce(response({ id: "task-123" })); await p.submit(req);
    fetch.mockResolvedValueOnce(response({ status: "SUCCEEDED", output: ["https://example.test/real.mp4"] }));
    const result = await p.poll(req.revisionId);
    expect(result.output).toHaveLength(1); expect(result.mediaVerified).toBe(false); expect(result.productionApproved).toBe(false);
    await p.poll(req.revisionId); expect(fetch).toHaveBeenCalledTimes(2); expect(reserve).toHaveBeenCalledTimes(1);
  });
  it("a claimed job with a missing checkpoint is never resubmitted", async () => {
    const p = new RunwayBenchmark("test", { async read() { return null; }, async claim() { return false; }, async save() {} }, async () => {});
    await expect(p.submit(req)).rejects.toThrow("új submit tiltva"); expect(fetch).not.toHaveBeenCalled();
  });
  it("production cannot select or directly invoke mock video success", async () => {
    vi.stubEnv("VERCEL", "1"); vi.stubEnv("GENVIDEO_PROVIDER", "mock");
    expect(getGenVideoProvider).toThrow("mock");
    await expect(new MockGenVideo().generate({ prompt: "x", referenceFrames: [], lockedCharacterIds: [], durationSec: 1, maxCostUsd: 1 })).rejects.toThrow("mock");
  });
  it("legacy remote errors never fall back to mock or duplicate POST", async () => {
    vi.stubEnv("VERCEL", ""); vi.stubEnv("NODE_ENV", "test");
    fetch.mockRejectedValue(new Error("network timeout"));
    await expect(new RemoteGenVideo("https://example.test", "test").generate({ prompt: "x", referenceFrames: [], lockedCharacterIds: [], durationSec: 1, maxCostUsd: 2 })).rejects.toThrow("SUBMISSION_UNCERTAIN");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
