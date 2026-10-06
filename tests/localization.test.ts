import { describe, it, expect } from "vitest";
import { hashKey, SUPPORTED_LANGUAGES, LOC_FLOW } from "@/lib/localization";
import { MockTranslationProvider } from "@/lib/providers/translation";

describe("Localization mapping", () => {
  it("mock translation provider jelöli a célnyelvet", async () => {
    const t = new MockTranslationProvider();
    const r = await t.translate({ text: "Szia!", sourceLang: "hu", targetLang: "en", characterName: "Márk", emotion: "happy", timingSec: 2, ageRange: "4-9" });
    expect(r.text).toBe("[EN] Szia!");
  });
  it("localization flow státuszok definiálva", () => {
    expect(LOC_FLOW).toContain("TRANSLATING");
    expect(LOC_FLOW).toContain("TTS_READY");
    expect(LOC_FLOW.indexOf("TRANSLATION_PENDING")).toBeLessThan(LOC_FLOW.indexOf("READY"));
  });
  it("támogatott nyelvek", () => { expect(SUPPORTED_LANGUAGES).toContain("de"); expect(SUPPORTED_LANGUAGES.length).toBeGreaterThanOrEqual(5); });
  it("audio cache hash determinisztikus", () => { expect(hashKey("abc")).toBe(hashKey("abc")); expect(hashKey("abc")).not.toBe(hashKey("abd")); });
});
