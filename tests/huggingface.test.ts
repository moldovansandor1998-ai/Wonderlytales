import { afterEach, describe, expect, it, vi } from "vitest";
import { checkHuggingFaceAccess } from "../src/lib/providers/huggingface";
afterEach(() => vi.unstubAllGlobals());
describe("HF access preflight", () => {
  it("does not call a provider without a configured secret", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect((await checkHuggingFaceAccess(undefined)).status).toBe("BLOCKED_MISSING_HF_TOKEN");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("distinguishes token validity from gated repository access", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 403 }));
    expect((await checkHuggingFaceAccess("test-secret")).status).toBe("BLOCKED_MODEL_ACCESS");
  });
  it("requires a successful parsed model config", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValueOnce({ status: 200, json: async () => ({ model_type: "dinov3_vit" }) }));
    expect((await checkHuggingFaceAccess("test-secret")).status).toBe("VERIFIED");
  });
  it("does not leak provider errors containing secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("test-secret")));
    const result = await checkHuggingFaceAccess("test-secret");
    expect(result.status).toBe("BLOCKED_NETWORK_OR_RESPONSE");
    expect(JSON.stringify(result)).not.toContain("test-secret");
  });
});
