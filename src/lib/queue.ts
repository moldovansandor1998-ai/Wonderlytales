import type { Db } from "./db";
import { newId, now } from "./db";
import type { RenderJob, JobStatus, CostEvent } from "./types";
import { getRenderWorker, gpuCost } from "./worker";

/** Render queue – idempotens retry, max attempt limit */
export async function enqueueJob(db: Db, job: Omit<RenderJob, "id"|"status"|"attempt"|"created_at"|"updated_at">): Promise<RenderJob> {
  return db.insert<RenderJob>("render_jobs", { ...job, id: newId(), status: "QUEUED", attempt: 0, created_at: now(), updated_at: now() });
}

export async function processNextJob(db: Db, jobId?: string): Promise<RenderJob | null> {
  const jobs = await db.find<RenderJob>("render_jobs", (j) => (!jobId || j.id === jobId) && (j.status === "QUEUED" || j.status === "RETRY_WAIT"));
  if (jobs.length === 0) return null;
  const job = jobs[0];
  const attempt = job.attempt + 1;
  await db.update<RenderJob>("render_jobs", job.id, { status: "RUNNING", attempt, updated_at: now() });
  try {
    const worker = getRenderWorker();
    const result = await worker.submit(job.input_snapshot, job.type === "FINAL" ? "FINAL" : "PREVIEW");
    if (result.status !== "SUCCEEDED") throw new Error(result.error ?? `Worker ${result.status}`);
    const unitPrice = gpuCost(1);
    const cost = gpuCost(result.gpuSec);
    const updated = await db.update<RenderJob>("render_jobs", job.id, { status: "SUCCEEDED", output_path: result.output, gpu_seconds: job.gpu_seconds + result.gpuSec, cost_usd: job.cost_usd + cost, updated_at: now() });
    await db.insert<CostEvent>("cost_events", { id: newId(), project_id: null, series_id: null, episode_id: null, shot_id: job.shot_id, job_id: job.id, retry: attempt > 1, category: attempt > 1 ? "RETRY" : "GPU", provider: worker.name, service: "render", amount_usd: cost, quantity: result.gpuSec, unit: "gpu_sec", unit_price_usd: unitPrice, currency: "USD", created_at: now() });
    return updated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const retryable = attempt < job.max_attempts;
    return db.update<RenderJob>("render_jobs", job.id, { status: retryable ? "RETRY_WAIT" : "FAILED", error: msg, updated_at: now() });
  }
}

export const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  QUEUED: ["CLAIMED","CANCELLED"],
  CLAIMED: ["RUNNING","CANCELLED"],
  RUNNING: ["SUCCEEDED","FAILED","RETRY_WAIT","CANCELLED"],
  RETRY_WAIT: ["QUEUED","CANCELLED"],
  SUCCEEDED: [],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
