import { afterEach, describe, expect, it, vi } from "vitest";
import { getRenderWorker } from "@/lib/worker";
import { getStorage } from "@/lib/providers/storage";
import { getTtsProvider } from "@/lib/providers/tts";
import { getStoryEngine } from "@/lib/providers/story";
import { getTranslationProvider } from "@/lib/providers/translation";
import { getFacialProvider } from "@/lib/providers/facial";

afterEach(() => vi.unstubAllEnvs());
describe("Production must fail instead of manufacturing success", () => {
  it("missing providers do not fall back to mock", () => {
    vi.stubEnv("VERCEL", "1");
    for (const key of ["RENDER_WORKER", "STORAGE_PROVIDER", "TTS_PROVIDER", "STORY_PROVIDER", "TRANSLATION_PROVIDER", "FACIAL_PROVIDER"]) vi.stubEnv(key, "");
    for (const getProvider of [getRenderWorker, getStorage, getTtsProvider, getStoryEngine, getTranslationProvider, getFacialProvider]) expect(getProvider).toThrow(/mock/);
  });
  it("an explicitly selected R2 provider identifies its missing secret", () => {
    vi.stubEnv("STORAGE_PROVIDER", "s3");
    vi.stubEnv("S3_ENDPOINT", "https://example.invalid");
    vi.stubEnv("S3_BUCKET", "test");
    vi.stubEnv("S3_ACCESS_KEY_ID", "test");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "");
    expect(getStorage).toThrow(/S3_SECRET_ACCESS_KEY/);
  });
});
