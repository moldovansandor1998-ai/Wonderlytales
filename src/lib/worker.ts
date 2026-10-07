import { requireConfiguration, rejectProductionMock } from "./config";
/** Render worker adapterek: MockRenderWorker (helyben) + RemoteRenderWorker (RunPod serverless) */
import { fetchWithTimeout } from "./providers/translation";
import { getPricing } from "./pricing";

export interface WorkerResult { status: "SUCCEEDED"|"FAILED"|"CANCELLED"; output: string | null; frames: number; durationSec: number; renderSec: number; gpuSec: number; renderer: string; error: string | null; }
export interface RenderWorker {
  name: string;
  submit(inputSnapshot: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult>;
  cancel(jobId: string): Promise<void>;
}

export class MockRenderWorker implements RenderWorker {
  name = "mock-worker";
  async submit(input: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult> {
    const shot = input as { shot_id?: string; revision?: number; duration_sec?: number; render?: { fps?: number } };
    const fps = shot.render?.fps ?? 24;
    const durationSec = shot.duration_sec ?? 5;
    const gpuSec = type === "FINAL" ? durationSec * 12 : durationSec * 2;
    return { status: "SUCCEEDED", output: `renders/${shot.shot_id}/${type.toLowerCase()}_r${shot.revision ?? 1}.mp4`, frames: Math.round(durationSec * fps), durationSec, renderSec: gpuSec / 4, gpuSec, renderer: "mock", error: null };
  }
  async cancel(): Promise<void> {}
}

/** RemoteRenderWorker: RunPod Serverless endpoint hívás – submit, poll, timeout, retry, cancel */
export class RemoteRenderWorker implements RenderWorker {
  name = "runpod";
  constructor(private endpointId: string, private apiKey: string, private timeoutMs = 15 * 60 * 1000) {}
  private base() { return `https://api.runpod.ai/v2/${this.endpointId}`; }

  async submit(input: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult> {
    const submit = await fetchWithTimeout(`${this.base()}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: { shot: input, type } }),
    }, 30000);
    if (!submit.ok) throw new Error(`RunPod submit hiba: HTTP ${submit.status} ${(await submit.text().catch(()=>"")).slice(0,200)}`);
    const job = await submit.json() as { id: string };
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await fetchWithTimeout(`${this.base()}/status/${job.id}`, { headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
      if (!st.ok) continue;
      const data = await st.json() as { status: string; output?: WorkerResult; executionTime?: number };
      if (data.status === "COMPLETED" && data.output) return { ...data.output, renderer: "runpod" };
      if (["FAILED","CANCELLED"].includes(data.status)) return { status: data.status === "FAILED" ? "FAILED" : "CANCELLED", output: null, frames: 0, durationSec: 0, renderSec: 0, gpuSec: (data.executionTime ?? 0) / 1000, renderer: "runpod", error: `RunPod job ${data.status}` };
    }
    await this.cancel(job.id).catch(() => {});
    throw new Error("RunPod timeout – job lemondva");
  }

  async cancel(jobId: string): Promise<void> {
    await fetchWithTimeout(`${this.base()}/cancel/${jobId}`, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
  }
}

export function getRenderWorker(): RenderWorker {
  if (process.env.RENDER_WORKER === "runpod") {
    requireConfiguration("RunPod", ["RUNPOD_API_KEY", "RUNPOD_ENDPOINT_ID"]);
    return new RemoteRenderWorker(process.env.RUNPOD_ENDPOINT_ID!, process.env.RUNPOD_API_KEY!);
  }
  rejectProductionMock("Render worker");
  return new MockRenderWorker();
}
export function gpuCost(gpuSec: number): number { return gpuSec * getPricing().gpuPerSec; }
