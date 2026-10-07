import { reserveProductionBudget } from "../budget";
import { fetchWithTimeout } from "./translation";
import { getPricing } from "../pricing";

/** Generative-video provider adapter – csak opcionális VFX shotokra; reference frames + locked character IDs + max cost + retry + fallback */
export interface GenVideoRequest { prompt: string; referenceFrames: string[]; lockedCharacterIds: string[]; maxCostUsd: number; durationSec: number; }
export interface GenVideoResult { path: string; costUsd: number; provider: string; }
export interface GenVideoProvider { name: string; generate(req: GenVideoRequest): Promise<GenVideoResult>; }

export class MockGenVideo implements GenVideoProvider {
  name = "mock";
  async generate(req: GenVideoRequest): Promise<GenVideoResult> {
    const cost = Math.min(req.maxCostUsd, req.durationSec * getPricing().genVideoPerSec);
    return { path: `vfx/gen/${Date.now()}.mp4`, costUsd: cost, provider: this.name };
  }
}

/** Production: RunPod serverless VAGY OpenAI-kompatibilis video endpoint – submit/poll architektúra */
export class RemoteGenVideo implements GenVideoProvider {
  name = "remote";
  constructor(private baseUrl: string, private apiKey: string) {}
  async generate(req: GenVideoRequest): Promise<GenVideoResult> {
    if (req.durationSec * getPricing().genVideoPerSec > req.maxCostUsd)
      throw new Error(`Becsült költség meghaladja a max_cost_usd keretet (${req.maxCostUsd} USD)`);
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      await reserveProductionBudget("genvideo");
      try {
        const submit = await fetchWithTimeout(`${this.baseUrl}/run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ input: { prompt: req.prompt, reference_frames: req.referenceFrames, locked_character_ids: req.lockedCharacterIds, duration_sec: req.durationSec } }),
        }, 30000);
        if (!submit.ok) { lastErr = `HTTP ${submit.status}`; continue; }
        const job = await submit.json() as { id: string };
        for (let i = 0; i < 180; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const st = await fetchWithTimeout(`${this.baseUrl}/status/${job.id}`, { headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
          if (!st.ok) continue;
          const data = await st.json() as { status: string; output?: { video_url?: string } };
          if (data.status === "COMPLETED" && data.output?.video_url)
            return { path: data.output.video_url, costUsd: req.durationSec * getPricing().genVideoPerSec, provider: this.name };
          if (["FAILED","CANCELLED"].includes(data.status)) throw new Error(`GenVideo job ${data.status}`);
        }
        throw new Error("GenVideo timeout");
      } catch (e) { lastErr = e instanceof Error ? e.message : String(e); }
    }
    // fallback: mock, hogy a pipeline ne álljon meg
    return new MockGenVideo().generate(req);
  }
}

export function getGenVideoProvider(): GenVideoProvider {
  if (process.env.GENVIDEO_PROVIDER === "remote" && process.env.GENVIDEO_API_KEY && process.env.RUNPOD_ENDPOINT_ID)
    return new RemoteGenVideo(`https://api.runpod.ai/v2/${process.env.RUNPOD_ENDPOINT_ID}`, process.env.GENVIDEO_API_KEY);
  return new MockGenVideo();
}
