/** Shot workflow: SAVE REVISION / PREVIEW / APPROVE / REJECT / RENDER AGAIN / FINAL */
import type { Db } from "./db";
import { newId, now } from "./db";
import type { ShotRow, RenderJob, ContinuityState } from "./types";
import { validateShot, type ShotData, type ShotStatusT } from "./schemas/shot";
import { stateFromShot, diffContinuity, type ContinuityWarning } from "./continuity";
import { enqueueJob, processNextJob } from "./queue";
import { runQc, shouldAutoRetry } from "./qc";
import { LockedAssetError } from "./assetVersioning";

const EDITABLE: ShotStatusT[] = ["DRAFT","SCRIPTED","READY_FOR_AUDIO","AUDIO_READY","READY_FOR_PREVIEW","QC_WARNING","QC_FAILED","PREVIEW_READY"];

/** LOCKED shot csak új revisionként változhat */
export async function saveShotRevision(db: Db, shotId: string, data: unknown): Promise<ShotRow> {
  const shot = await db.get<ShotRow>("shots", shotId);
  if (!shot) throw new Error("Shot nem található");
  if (shot.status === "LOCKED") throw new LockedAssetError("LOCKED shot – mentsd új revisionként.");
  if (!EDITABLE.includes(shot.status)) throw new Error(`A shot jelenleg nem szerkeszthető (${shot.status})`);
  const parsed = validateShot(data);
  const revision = shot.revision + 1;
  parsed.revision = revision;
  return db.update<ShotRow>("shots", shotId, { data: parsed, revision });
}

/** Continuity: az előző shot output state-e alapján input state + diff */
export async function applyContinuity(db: Db, shot: ShotRow): Promise<{ warnings: ContinuityWarning[] }> {
  const siblings = (await db.find<ShotRow>("shots", (s) => s.scene_id === shot.scene_id)).sort((a, b) => a.shot_number - b.shot_number);
  const idx = siblings.findIndex((s) => s.id === shot.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const input = stateFromShot(shot.data);
  let warnings: ContinuityWarning[] = [];
  if (prev) {
    const prevOut = await db.find<ContinuityState>("continuity_states", (c) => c.shot_id === prev.id && c.kind === "OUTPUT");
    warnings = diffContinuity(prevOut[0]?.state ?? null, input);
    shot.data.continuity.input_state_id = prevOut[0]?.id ?? null;
  }
  const inputRow = await db.insert<ContinuityState>("continuity_states", { id: newId(), scene_id: shot.scene_id, shot_id: shot.id, kind: "INPUT", state: input });
  shot.data.continuity.input_state_id = shot.data.continuity.input_state_id ?? inputRow.id;
  const outRow = await db.insert<ContinuityState>("continuity_states", { id: newId(), scene_id: shot.scene_id, shot_id: shot.id, kind: "OUTPUT", state: input });
  shot.data.continuity.output_state_id = outRow.id;
  await db.update<ShotRow>("shots", shot.id, { data: shot.data });
  return { warnings };
}

/** Worker dispatch → actual render → QC → bounded retry. */
export async function generatePreview(db: Db, shotId: string): Promise<RenderJob> {
  const shot = await db.get<ShotRow>("shots", shotId);
  if (!shot) throw new Error("Shot nem található");
  const provider=process.env.RENDER_WORKER ?? "mock";
  const job = await enqueueJob(db, { shot_id: shotId, type: "PREVIEW", worker: provider, provider, max_attempts: 3, input_snapshot: { ...shot.data }, output_path: null, gpu_seconds: 0, cost_usd: 0, error: null });
  await db.update<ShotRow>("shots", shotId, { status: "PREVIEW_RENDERING" });
  const done = await processNextJob(db, job.id);
  if (done?.status === "SUCCEEDED") {
    const results = await runQc(db, (await db.get<ShotRow>("shots", shotId))!, done.id, !!done.output_path, done.output_path);
    for (const r of results) {
      if (shouldAutoRetry(r.check_name, r.status, done.attempt, done.max_attempts)) {
        await enqueueJob(db, { shot_id: shotId, type: "PREVIEW", worker: provider, provider, max_attempts: 3, input_snapshot: { ...shot.data }, output_path: null, gpu_seconds: 0, cost_usd: 0, error: null });
      }
    }
  }
  return done ?? job;
}

export async function setShotStatus(db: Db, shotId: string, status: ShotStatusT): Promise<ShotRow> {
  return db.update<ShotRow>("shots", shotId, { status });
}

export async function finalRender(db: Db, shotId: string): Promise<RenderJob> {
  const shot = await db.get<ShotRow>("shots", shotId);
  if (!shot) throw new Error("Shot nem található");
  if (shot.status !== "APPROVED_FOR_FINAL") throw new Error("A shot nincs jóváhagyva final renderre");
  if (shot.data.render.engine === "MOCK") throw new Error("Mock jelenet nem készülhet végleges filmként.");
  const data: ShotData = { ...shot.data, render: { ...shot.data.render, quality: "FINAL" } };
  await db.update<ShotRow>("shots", shotId, { status: "FINAL_RENDERING", data });
  const provider=process.env.RENDER_WORKER ?? "mock";
  const job = await enqueueJob(db, { shot_id: shotId, type: "FINAL", worker: provider, provider, max_attempts: 2, input_snapshot: { ...data }, output_path: null, gpu_seconds: 0, cost_usd: 0, error: null });
  const done = await processNextJob(db, job.id);
  if (done?.status === "SUCCEEDED") {
    const results=await runQc(db,(await db.get<ShotRow>('shots',shotId))!,done.id,!!done.output_path,done.output_path);
    if (results.length && results.every(r => r.status==='PASS' && r.score>=data.qc.minimum_score)) await db.update<ShotRow>("shots", shotId, { status: "FINAL_READY" });
  }
  return done ?? job;
}
