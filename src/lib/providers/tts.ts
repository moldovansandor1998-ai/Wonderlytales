import { reserveProductionBudget } from "../budget";
import { requireConfiguration, rejectProductionMock } from "../config";
import { createHash } from "crypto";
import { fetchWithTimeout } from "./translation";
import { getPricing } from "../pricing";

/** TTS provider interface + MOCK + teljes ElevenLabs adapter (timeout, retry, rate-limit, cache hash, cost) */
export interface TtsResult { path: string; durationSec: number; provider: string; audio?: Buffer; costUsd: number; }
export interface TtsConfig { language: string; voiceId: string; model?: string; stability?: number; style?: number; budgetService?: "tts" | "tts_dialogue"; }
export interface TtsProvider { name: string; synthesize(text: string, cfg: TtsConfig): Promise<TtsResult>; }

/** Legacy Hungarian V2 settings must never reuse unsupported-language audio. */
export function resolveTtsModel(cfg: TtsConfig): string {
  const model = cfg.model ?? "eleven_multilingual_v2";
  if (cfg.language === "hu" && model === "eleven_multilingual_v2") return "eleven_flash_v2_5";
  return model;
}

export function ttsCacheKey(text: string, cfg: TtsConfig): string {
  return createHash("sha256").update(JSON.stringify([text, cfg.voiceId, resolveTtsModel(cfg), cfg.language, cfg.stability, cfg.style])).digest("hex").slice(0, 24);
}

export class MockTts implements TtsProvider {
  name = "mock";
  async synthesize(text: string, cfg: TtsConfig): Promise<TtsResult> {
    return { path: `audio/tts/${cfg.language}/${cfg.voiceId}/${ttsCacheKey(text, cfg)}.wav`, durationSec: Math.max(1, text.length / 14), provider: this.name, costUsd: 0 };
  }
}

export class ElevenLabsTts implements TtsProvider {
  name = "elevenlabs";
  constructor(private apiKey: string, private baseUrl = "https://api.elevenlabs.io/v1") {}

  async synthesize(text: string, cfg: TtsConfig): Promise<TtsResult> {
    const limit = cfg.budgetService === "tts_dialogue" ? 250 : 1000;
    const model = resolveTtsModel(cfg);
    if (!["eleven_multilingual_v2", "eleven_flash_v2_5", "eleven_v3"].includes(model)) {
      throw new Error("ElevenLabs: nem támogatott beszédmodell.");
    }
    if (!text.trim() || text.length > limit) {
      throw new Error(`ElevenLabs: szöveg szükséges, legfeljebb ${limit} karakter.`);
    }
    if (!/^[a-zA-Z0-9]+$/.test(cfg.voiceId)) throw new Error("Érvénytelen hangazonosító");
    const url = `${this.baseUrl}/text-to-speech/${cfg.voiceId}?output_format=mp3_44100_128`;
    const body = JSON.stringify({
      text, model_id: model,
      ...(model !== "eleven_multilingual_v2" ? { language_code: cfg.language } : {}),
      voice_settings: { stability: cfg.stability ?? 0.5, style: cfg.style ?? 0, use_speaker_boost: true },
    });
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      await reserveProductionBudget(cfg.budgetService ?? "tts");
      try {
        const res = await fetchWithTimeout(url, { method: "POST", headers: { "xi-api-key": this.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" }, body }, 45000);
        if (res.status === 429) { // rate-limit: Retry-After tiszteletben tartása
          const wait = Math.min(10, Math.max(1, Number(res.headers.get("retry-after") ?? 2) || 2)) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          lastErr = `429 rate-limit (attempt ${attempt + 1})`;
          continue;
        }
        if (!res.ok) { lastErr = `HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`; if (res.status >= 500) continue; throw new Error(`ElevenLabs hiba: ${lastErr}`); }
        const audio = Buffer.from(await res.arrayBuffer());
        if (audio.length < 100) throw new Error("ElevenLabs: gyanúsan kis audio válasz");
        const key = `audio/tts/${cfg.language}/${cfg.voiceId}/${ttsCacheKey(text, cfg)}.mp3`;
        // duration: MP3 frame-becslés helyett karakteralapú fallback + exakt, ha ffprobe elérhető (assembly-ben)
        const durationSec = Math.max(1, text.length / 14);
        const costUsd = text.length * getPricing().ttsPerChar;
        return { path: key, durationSec, provider: this.name, audio, costUsd };
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("ElevenLabs hiba")) throw e;
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`ElevenLabs sikertelen 3 próbálkozás után: ${lastErr}`);
  }
}

export function getTtsProvider(): TtsProvider {
  if (process.env.TTS_PROVIDER === "elevenlabs") {
    requireConfiguration("ElevenLabs", ["ELEVENLABS_API_KEY"]);
    return new ElevenLabsTts(process.env.ELEVENLABS_API_KEY!);
  }
  rejectProductionMock("TTS");
  return new MockTts();
}
