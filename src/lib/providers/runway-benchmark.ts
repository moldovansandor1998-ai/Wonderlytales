/** Isolated technology trial, not the legacy native render endpoint.
 * Official schema checked 2026-10-10: runwayml/sdk-python + Runway Dev pricing.
 * Image references guide identity; they do NOT constitute an identity lock.
 */
import { createHash } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getProductionBudget, reserveProductionBudget } from "../budget";
import { isProduction } from "../config";
import { fetchWithTimeout } from "./translation";

export interface ReferenceMedia { uri: string; sha256: string; }
export interface RunwayTrialRequest {
  revisionId: string; prompt: string; durationSec: number; seed: number;
  images: ReferenceMedia[]; audio?: ReferenceMedia;
  maxCostUsd: number;
}
export interface TrialCheckpoint {
  requestHash: string; model: "seedance2_5"; estimatedCostUsd: number;
  status: "SUBMITTING" | "BLOCKED_BUDGET" | "SUBMISSION_UNCERTAIN" | "PENDING" |
    "RUNNING" | "THROTTLED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  taskId?: string; output?: string[];
  mediaVerified: false; productionApproved: false;
}
export interface TrialStore {
  read(id: string): Promise<TrialCheckpoint | null>;
  claim(id: string, initial: TrialCheckpoint): Promise<boolean>;
  save(id: string, value: TrialCheckpoint): Promise<void>;
}
const safeId = (id: string) => {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Érvénytelen próbaverzió-azonosító");
  return id;
};
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const notFound = (e: unknown) => (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404;

/** A permanent conditional claim prevents duplicate paid submits after a crash.
 * Existing R2 bucket, separate prefix; no endpoint or infrastructure replacement.
 */
export class R2TrialStore implements TrialStore {
  constructor(private client: S3Client, private bucket: string) {}
  private key(id: string, kind: string) { return `experiments/TECH_AB_V001/jobs/${safeId(id)}.${kind}.json`; }
  async read(id: string): Promise<TrialCheckpoint | null> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(id, "state") }));
      return JSON.parse(await r.Body!.transformToString()) as TrialCheckpoint;
    } catch (e) { if (notFound(e)) return null; throw e; }
  }
  async claim(id: string, initial: TrialCheckpoint): Promise<boolean> {
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(id, "claim"),
        Body: JSON.stringify(initial), ContentType: "application/json", IfNoneMatch: "*" }));
    } catch (e) {
      if ((e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 412) return false;
      throw e;
    }
    await this.save(id, initial);
    return true;
  }
  async save(id: string, value: TrialCheckpoint) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.key(id, "state"),
      Body: JSON.stringify(value), ContentType: "application/json" }));
  }
}

export function runwayTrialPayload(req: RunwayTrialRequest) {
  safeId(req.revisionId);
  if (!Number.isInteger(req.durationSec) || req.durationSec < 4 || req.durationSec > 24)
    throw new Error("A próba 4–24 egész másodperc lehet");
  if (!req.prompt.trim() || req.prompt.length > 15000) throw new Error("Érvénytelen prompt");
  if (!Number.isInteger(req.seed) || req.seed < 0 || req.seed > 4294967295) throw new Error("Érvénytelen seed");
  if (req.images.length < 2 || req.images.length > 4) throw new Error("2–4 ellenőrzött karakter/helyszín referencia szükséges");
  for (const ref of [...req.images, ...(req.audio ? [req.audio] : [])]) {
    if (!/^[a-f0-9]{64}$/.test(ref.sha256)) throw new Error("Hiányzó média SHA-256");
    // URLs can be short-lived signed private R2 URLs. Never log them.
    if (!/^https:\/\//.test(ref.uri) && !/^runway:\/\//.test(ref.uri)) throw new Error("HTTPS vagy Runway feltöltés szükséges");
  }
  // Fixed 1080p MP4, fixed duration, no video refs/draft/HDR surcharge.
  // $0.68/output second, $0.01/credit; minimum 80 credits is below 4s cost.
  const estimate = Math.ceil(req.durationSec * 68) / 100;
  if (!Number.isFinite(req.maxCostUsd) || req.maxCostUsd < estimate) throw new Error("A próba meghaladja a költségplafont");
  const body = { model: "seedance2_5" as const, duration: req.durationSec, ratio: "1920:1080",
    promptText: req.prompt, promptImage: req.images.map(r => ({ uri: r.uri })), seed: req.seed,
    audio: !!req.audio, ...(req.audio ? { referenceAudio: [{ type: "audio", uri: req.audio.uri }] } : {}) };
  // URI rotation does not change the identity of the same source media.
  const requestHash = hash({ ...body, promptImage: req.images.map(r => r.sha256),
    referenceAudio: req.audio?.sha256 ?? null, maxCostUsd: req.maxCostUsd });
  return { body, estimate, requestHash };
}

async function reserveTrialCost(estimate: number) {
  if (!isProduction()) throw new Error("Fizetős Runway próba csak ellenőrzött éles költségnyilvántartással indítható");
  const budget = await getProductionBudget();
  const ceiling = budget?.configured_services.genvideo;
  if (!ceiling || ceiling < estimate) throw new Error("A genvideo költségplafonja nincs ellenőrizve ehhez a próbához");
  await reserveProductionBudget("genvideo");
}

export class RunwayBenchmark {
  constructor(private apiKey: string, private store: TrialStore,
    private reserve: (estimate: number) => Promise<void> = reserveTrialCost) {
    if (!apiKey.trim()) throw new Error("RUNWAY_API_KEY hiányzik");
  }
  private async call(endpoint: string, body?: unknown) {
    const r = await fetchWithTimeout(`https://api.dev.runwayml.com/v1/${endpoint}`, {
      method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${this.apiKey}`,
        "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}) }, 30000);
    if (!r.ok) throw new Error(`Runway HTTP ${r.status}`);
    return await r.json() as Record<string, unknown>;
  }
  async submit(req: RunwayTrialRequest): Promise<TrialCheckpoint> {
    const { body, estimate, requestHash } = runwayTrialPayload(req);
    const previous = await this.store.read(req.revisionId);
    if (previous) {
      if (previous.requestHash !== requestHash) throw new Error("Meglévő próbaverzió nem írható felül; külön revízió kell");
      return previous; // including failed/uncertain: never silently regenerate
    }
    const state: TrialCheckpoint = { requestHash, model: "seedance2_5", estimatedCostUsd: estimate,
      status: "SUBMITTING", mediaVerified: false, productionApproved: false };
    if (!await this.store.claim(req.revisionId, state)) {
      const existing = await this.store.read(req.revisionId);
      if (!existing || existing.requestHash !== requestHash) throw new Error("Foglalt vagy bizonytalan próba; új submit tiltva");
      return existing;
    }
    try { await this.reserve(estimate); }
    catch (e) { state.status = "BLOCKED_BUDGET"; await this.store.save(req.revisionId, state); throw e; }
    try {
      const job = await this.call("image_to_video", body);
      if (typeof job.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(job.id)) throw new Error("Hiányzó Runway task ID");
      state.taskId = job.id; state.status = "PENDING";
      await this.store.save(req.revisionId, state);
      return state;
    } catch {
      state.status = "SUBMISSION_UNCERTAIN";
      await this.store.save(req.revisionId, state);
      throw new Error(`RUNWAY_SUBMISSION_UNCERTAIN (${req.revisionId}); nincs automatikus újraküldés`);
    }
  }
  async poll(revisionId: string): Promise<TrialCheckpoint> {
    const state = await this.store.read(safeId(revisionId));
    if (!state?.taskId) throw new Error("Nincs mentett task ID; előbb szolgáltatói egyeztetés szükséges");
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status)) return state;
    const job = await this.call(`tasks/${encodeURIComponent(state.taskId)}`);
    const statuses = ["PENDING", "RUNNING", "THROTTLED", "SUCCEEDED", "FAILED", "CANCELLED"];
    if (typeof job.status !== "string" || !statuses.includes(job.status)) throw new Error("Ismeretlen Runway állapot");
    state.status = job.status as TrialCheckpoint["status"];
    if (job.status === "SUCCEEDED") {
      if (!Array.isArray(job.output) || !job.output.length || job.output.some(u => typeof u !== "string" || !u.startsWith("https://")))
        throw new Error("A sikeres feladathoz nem tartozik ellenőrizhető videó URL");
      state.output = job.output as string[];
    }
    await this.store.save(revisionId, state);
    return state; // decode/hash/visual QA remain separate required gates
  }
}
