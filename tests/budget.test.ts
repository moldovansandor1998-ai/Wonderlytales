import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const rpc = vi.fn();
vi.mock("@/lib/auth", () => ({ createServerSupabase: () => ({ rpc }) }));
import { reserveProductionBudget } from "@/lib/budget";
import { RemoteRenderWorker } from "@/lib/worker";
import { RemoteGenVideo } from "@/lib/providers/genvideo";

describe("Paid submission budget", () => {
  beforeEach(() => { vi.stubEnv("VERCEL", "1"); rpc.mockReset(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("reserves through the shared database before submission", async () => {
    rpc.mockResolvedValue({ data: { reservation_id: "r1" }, error: null });
    await reserveProductionBudget("runpod");
    expect(rpc).toHaveBeenCalledWith("reserve_production_budget", { p_service: "runpod" });
  });
  it("does not contact RunPod when the budget is exhausted", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "DAILY_BUDGET_EXCEEDED" } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(new RemoteRenderWorker("endpoint", "key").submit({}, "FINAL")).rejects.toThrow("keret elfogyott");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not retry or return mock video when a ceiling is unverified", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "BUDGET_SERVICE_CEILING_UNVERIFIED" } });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(new RemoteGenVideo("https://example.test", "key").generate({ prompt: "x", referenceFrames: [], lockedCharacterIds: [], maxCostUsd: 10, durationSec: 1 })).rejects.toThrow("költségplafonja");
    expect(fetch).not.toHaveBeenCalled(); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("fails closed when the ledger is unavailable", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection failed" } });
    await expect(reserveProductionBudget("runpod")).rejects.toThrow("nem ellenőrizhető");
  });
});
