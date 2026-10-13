import { z } from "zod";
import { reserveProductionBudget } from "@/lib/budget";

export const AVATAR_SECONDS = 60;
export const PIRATE_VOICE = "f9YzCDZYS8Zjl6RbHErx";
export const avatarRequest = z.object({ requestId: z.string().uuid() }).strict();
const runwayBase = "https://api.dev.runwayml.com";
export class AvatarError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
export function avatarConfiguration() {
  return {
    runway: !!process.env.RUNWAYML_API_SECRET,
    character: !!process.env.RUNWAY_AVATAR_ID,
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    agent: !!process.env.ELEVENLABS_AGENT_ID,
  };
}
function config() {
  if (!Object.values(avatarConfiguration()).every(Boolean)) throw new AvatarError("AVATAR_NOT_CONFIGURED");
  const avatarId = z.string().uuid().parse(process.env.RUNWAY_AVATAR_ID);
  const agentId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).parse(process.env.ELEVENLABS_AGENT_ID);
  return { avatarId, agentId, runwayKey: process.env.RUNWAYML_API_SECRET!, elevenKey: process.env.ELEVENLABS_API_KEY! };
}
async function runway(path: string, method = "GET", body?: unknown) {
  const key = process.env.RUNWAYML_API_SECRET;
  if (!key) throw new AvatarError("AVATAR_NOT_CONFIGURED");
  const response = await fetch(`${runwayBase}/v1/${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (method === "DELETE" && response.status === 404) return null;
  if (!response.ok) throw new AvatarError(response.status === 401 ? "RUNWAY_ACCESS_DENIED" : response.status === 402 ? "RUNWAY_CREDITS_REQUIRED" : "RUNWAY_REQUEST_FAILED");
  return method === "DELETE" || response.status === 204 ? null : response.json();
}
async function eleven(path: string, key: string) {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/${path}`, {
    cache: "no-store", headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new AvatarError("ELEVENLABS_AGENT_ACCESS_DENIED");
  return response.json();
}
/** Read-only preflight: reject an unusable avatar/agent before reserving or spending. */
export async function prepareAvatar() {
  const c = config();
  const [avatar, agent] = await Promise.all([
    runway(`avatars/${c.avatarId}`), eleven(`agents/${c.agentId}`, c.elevenKey),
  ]);
  if (avatar?.status !== "READY") throw new AvatarError("RUNWAY_CHARACTER_NOT_READY");
  const settings = agent?.conversation_config;
  if (settings?.asr?.user_input_audio_format !== "pcm_16000" || settings?.agent?.language !== "hu" ||
      settings?.tts?.voice_id !== PIRATE_VOICE ||
      typeof settings?.conversation?.max_duration_seconds !== "number" ||
      settings.conversation.max_duration_seconds < 1 || settings.conversation.max_duration_seconds > AVATAR_SECONDS) {
    throw new AvatarError("ELEVENLABS_AGENT_SETTINGS_REQUIRED");
  }
  const signed = await eleven(`conversation/get-signed-url?agent_id=${encodeURIComponent(c.agentId)}`, c.elevenKey);
  const url = z.string().url().parse(signed.signed_url);
  if (new URL(url).protocol !== "wss:" || new URL(url).hostname !== "api.elevenlabs.io") throw new AvatarError("ELEVENLABS_AGENT_ACCESS_DENIED");
  return { avatarId: c.avatarId, signedUrl: url };
}
/** No retries. Both providers must have verified per-attempt budget ceilings. */
export async function createAvatar(prepared: Awaited<ReturnType<typeof prepareAvatar>>) {
  await reserveProductionBudget("runway_live_60s");
  await reserveProductionBudget("elevenlabs_agent_60s");
  const data = await runway("realtime_sessions", "POST", {
    model: "gwm1_avatars", avatar: { type: "custom", avatarId: prepared.avatarId },
    integration: { type: "elevenlabs", signedUrl: prepared.signedUrl }, maxDuration: AVATAR_SECONDS,
  });
  return z.string().uuid().parse(data?.id);
}
export async function retrieveAvatar(sessionId: string) {
  z.string().uuid().parse(sessionId);
  const data = await runway(`realtime_sessions/${sessionId}`);
  const status = z.enum(["NOT_READY", "READY", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]).parse(data?.status);
  if (status === "READY") return { status, sessionId, sessionKey: z.string().min(1).max(10000).parse(data.sessionKey) };
  return { status, sessionId };
}
export async function cancelAvatar(sessionId: string) {
  z.string().uuid().parse(sessionId);
  await runway(`realtime_sessions/${sessionId}`, "DELETE");
}

export type AvatarRecord = {
  requestId: string;
  state: "creating" | "active" | "cancel_requested" | "ended" | "failed";
  createdAt: string;
  sessionId?: string;
};
