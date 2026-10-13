import { z } from "zod";
import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { R2VideoStore, digest } from "@/lib/ai-video/storage";
import { downloadProviderMedia } from "@/lib/ai-video/media";
import { AvatarError } from "./avatar";
import { retrieveMotion } from "./motion";

export const BACKDROP_ID = "00000000-0000-4000-8000-000000000002";
export const BACKDROP_COST = 0.60; // Fixed Gen-4.5, 5 seconds, 12 credits/second.
export type BackdropRecord = {
  status: "SUBMITTING" | "PENDING" | "SUCCEEDED" | "FAILED" | "UNCERTAIN";
  createdAt: string; taskId?: string; assetId?: string;
};
type Store = Pick<R2VideoStore, "readRecord" | "writeRecord" | "putAsset">;
export const backdropPayload = {
  model: "gen4.5", duration: 5, ratio: "720:1280",
  promptImage: "https://wonderlytales.vercel.app/live-studio/ali-isti.webp",
  promptText: "Locked-off camera, the exact two characters and the exact cozy witch cabin from the image. Quiet seamless idle animation for a live show. The purple witch stands in place, breathes softly, blinks and makes a tiny knowing smile. The seated grumpy man stays seated, shifts his shoulders slightly, blinks and glances toward the witch. Both keep their mouths closed. Gentle candle flicker. Small natural body movements only. The same faces, clothes, hats, chair, framing and lighting throughout. End in the initial pose for looping. No speech, no text, no cuts, no camera movement, no new characters, no transformations.",
};

/** One permanent owner-scoped claim. Poll/reload/repeated starts never regenerate it. */
export async function startBackdrop(store: Store) {
  const old = await store.readRecord<BackdropRecord>("live-backdrop", BACKDROP_ID);
  if (old) return old.value;
  if (!process.env.RUNWAYML_API_SECRET) throw new AvatarError("MOTION_NOT_CONFIGURED");
  const budget = await getProductionBudget();
  if (!budget || (budget.configured_services.runway_backdrop_5s ?? 0) < BACKDROP_COST) throw new AvatarError("BACKDROP_BUDGET_NOT_CONFIGURED", 409);
  const record: BackdropRecord = { status: "SUBMITTING", createdAt: new Date().toISOString() };
  if (!await store.writeRecord("live-backdrop", BACKDROP_ID, record)) {
    const current = await store.readRecord<BackdropRecord>("live-backdrop", BACKDROP_ID);
    if (!current) throw new AvatarError("BACKDROP_UNCERTAIN", 409);
    return current.value;
  }
  const claim = await store.readRecord<BackdropRecord>("live-backdrop", BACKDROP_ID);
  if (!claim) throw new AvatarError("BACKDROP_UNCERTAIN", 409);
  try {
    await reserveProductionBudget("runway_backdrop_5s");
    const response = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${process.env.RUNWAYML_API_SECRET}`, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" },
      body: JSON.stringify(backdropPayload),
    });
    if (!response.ok) throw new AvatarError("BACKDROP_GENERATION_FAILED");
    const taskId = z.string().uuid().parse((await response.json()).id);
    const next: BackdropRecord = { ...record, status: "PENDING", taskId };
    if (!await store.writeRecord("live-backdrop", BACKDROP_ID, next, claim.etag)) throw new AvatarError("BACKDROP_UNCERTAIN", 409);
    return next;
  } catch (error) {
    const latest = await store.readRecord<BackdropRecord>("live-backdrop", BACKDROP_ID);
    if (latest && !latest.value.taskId) await store.writeRecord("live-backdrop", BACKDROP_ID, { ...record, status: "UNCERTAIN" }, latest.etag);
    throw error;
  }
}

export async function readBackdrop(store: Store) {
  const saved = await store.readRecord<BackdropRecord>("live-backdrop", BACKDROP_ID);
  if (!saved) return { status: "MISSING" };
  if (saved.value.assetId) return { status: "SUCCEEDED", url: `/api/ai-video/assets/${saved.value.assetId}` };
  if (!saved.value.taskId || saved.value.status !== "PENDING") return { status: saved.value.status };
  const task = await retrieveMotion(saved.value.taskId);
  if (task.status === "FAILED" || task.status === "CANCELLED") {
    await store.writeRecord("live-backdrop", BACKDROP_ID, { ...saved.value, status: "FAILED" }, saved.etag);
    return { status: "FAILED" };
  }
  if (task.status !== "SUCCEEDED" || !task.url) return { status: "PENDING" };
  const bytes = await downloadProviderMedia(task.url, 100 * 1024 * 1024);
  if (bytes.length < 100 || bytes.toString("ascii", 4, 8) !== "ftyp") throw new AvatarError("MOTION_INVALID_VIDEO");
  const assetId = digest(bytes);
  await store.putAsset(assetId, "mp4", bytes);
  await store.writeRecord("live-backdrop", BACKDROP_ID, { ...saved.value, status: "SUCCEEDED", assetId }, saved.etag);
  return { status: "SUCCEEDED", url: `/api/ai-video/assets/${assetId}` };
}
