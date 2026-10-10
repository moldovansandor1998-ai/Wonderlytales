import { reserveProductionBudget } from "../budget";
import { fetchWithTimeout } from "./translation";
import { getPricing } from "../pricing";
import { rejectProductionMock, requireConfiguration } from "../config";

/** Legacy custom worker adapter. Character IDs are metadata, not a visual identity guarantee. */
export interface GenVideoRequest { prompt: string; referenceFrames: string[]; lockedCharacterIds: string[]; maxCostUsd: number; durationSec: number; resumeJobId?: string; }
export interface GenVideoResult { path: string; costUsd: number; provider: string; jobId?: string; simulated?: boolean; costBasis?: "estimate"; }
export interface GenVideoProvider { name: string; generate(req: GenVideoRequest): Promise<GenVideoResult>; }

export class MockGenVideo implements GenVideoProvider {
  name = "mock";
  async generate(req: GenVideoRequest): Promise<GenVideoResult> {
    rejectProductionMock("Generált videó");
    const cost = Math.min(req.maxCostUsd, req.durationSec * getPricing().genVideoPerSec);
    return { path: `vfx/gen/${Date.now()}.mp4`, costUsd: cost, provider: this.name, simulated: true, costBasis: "estimate" };
  }
}

/** Custom RunPod /run + /status protocol; never use the native Blender endpoint here. */
export class RemoteGenVideo implements GenVideoProvider {
  name = "remote";
  constructor(private baseUrl: string, private apiKey: string) {}
  async generate(req: GenVideoRequest): Promise<GenVideoResult> {
    const estimate = req.durationSec * getPricing().genVideoPerSec;
    if (!Number.isFinite(estimate) || estimate <= 0 || !Number.isFinite(req.maxCostUsd) || estimate > req.maxCostUsd)
      throw new Error(`Becsült költség meghaladja a max_cost_usd keretet (${req.maxCostUsd} USD)`);
    let jobId = req.resumeJobId;
    if (jobId && !/^[a-zA-Z0-9_-]+$/.test(jobId)) throw new Error("Érvénytelen videó job ID");
    if (!jobId) {
      await reserveProductionBudget("genvideo");
      try {
        const submit = await fetchWithTimeout(`${this.baseUrl}/run`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ input: { prompt: req.prompt, reference_frames: req.referenceFrames, locked_character_ids: req.lockedCharacterIds, duration_sec: req.durationSec } }),
        }, 30000);
        if (!submit.ok) throw new Error(`HTTP ${submit.status}`);
        const job = await submit.json() as { id: string };
        if (!job.id || !/^[a-zA-Z0-9_-]+$/.test(job.id)) throw new Error("Hiányzó job ID");
        jobId = job.id;
      } catch {
        throw new Error("GENVIDEO_SUBMISSION_UNCERTAIN: nincs automatikus újraküldés; ellenőrizd a szolgáltató feladatait.");
      }
    }
    try {
      for (let i = 0; i < 180; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const st = await fetchWithTimeout(`${this.baseUrl}/status/${jobId}`, { headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
          if (!st.ok) continue;
          const data = await st.json() as { status: string; output?: { video_url?: string } };
          if (data.status === "COMPLETED" && data.output?.video_url)
            return { path: data.output.video_url, costUsd: estimate, provider: this.name, jobId, costBasis: "estimate" };
          if (["FAILED","CANCELLED"].includes(data.status)) throw new Error(`GenVideo job ${data.status}`);
      }
      throw new Error("GenVideo timeout");
    } catch (error) {
      throw new Error(`GenVideo job ${jobId}: ${error instanceof Error ? error.message : "poll hiba"}. Folytatás resumeJobId-val; új fizetős submit nélkül.`);
    }
  }
}

export function getGenVideoProvider(): GenVideoProvider {
  if (process.env.GENVIDEO_PROVIDER === "remote") {
    requireConfiguration("AI-videó", ["GENVIDEO_API_KEY", "GENVIDEO_RUNPOD_ENDPOINT_ID"]);
    return new RemoteGenVideo(`https://api.runpod.ai/v2/${process.env.GENVIDEO_RUNPOD_ENDPOINT_ID}`, process.env.GENVIDEO_API_KEY!);
  }
  rejectProductionMock("Generált videó");
  return new MockGenVideo();
}
