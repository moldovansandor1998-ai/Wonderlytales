import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { R2VideoStore } from "@/lib/ai-video/storage";
import { AVATAR_SECONDS, AvatarError, avatarRequest, cancelAvatar, createAvatar, prepareAvatar, retrieveAvatar, type AvatarRecord } from "@/lib/live/avatar";

export const runtime = "nodejs";
export const maxDuration = 60;
const errorResponse = (e: unknown) => e instanceof AvatarError ? json({ error: e.code }, e.status) : apiError(e);

export async function POST(request: NextRequest) {
  let sessionId: string | undefined;
  try {
    const user = await access(request, true);
    const { requestId } = avatarRequest.parse(await readJson(request));
    const prepared = await prepareAvatar();
    const store = new R2VideoStore(user.id);
    const record: AvatarRecord = { requestId, state: "creating", createdAt: new Date().toISOString() };
    if (!await store.writeRecord("live-avatar", requestId, record)) throw new AvatarError("AVATAR_REQUEST_ALREADY_USED", 409);
    // Store only IDs/state, never API keys, signed URLs or WebRTC credentials.
    sessionId = await createAvatar(prepared);
    const claimed = await store.readRecord<AvatarRecord>("live-avatar", requestId);
    if (!claimed || claimed.value.state !== "creating") throw new AvatarError("AVATAR_CANCELLED", 409);
    if (!await store.writeRecord("live-avatar", requestId, { ...record, sessionId, state: "active" }, claimed.etag)) throw new AvatarError("AVATAR_CANCELLED", 409);
    return json({ requestId, maxSeconds: AVATAR_SECONDS });
  } catch (e) {
    // Cancellation racing creation and failed storage both close the paid worker.
    // An ambiguous create failure has no ID to cancel; the provider duration cap remains in force.
    if (sessionId) { try { await cancelAvatar(sessionId); } catch { return json({ error: "AVATAR_CLEANUP_PENDING" }, 503); } }
    return errorResponse(e);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await access(request);
    const { requestId } = avatarRequest.parse({ requestId: request.nextUrl.searchParams.get("requestId") });
    const store = new R2VideoStore(user.id);
    const record = await store.readRecord<AvatarRecord>("live-avatar", requestId);
    if (!record) throw new AvatarError("AVATAR_NOT_FOUND", 404);
    if (["ended", "cancel_requested", "failed"].includes(record.value.state)) return json({ status: "CANCELLED" });
    if (!record.value.sessionId) return json({ status: "NOT_READY" });
    return json(await retrieveAvatar(record.value.sessionId));
  } catch (e) { return errorResponse(e); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await access(request, true);
    const { requestId } = avatarRequest.parse(await readJson(request));
    const store = new R2VideoStore(user.id);
    const record = await store.readRecord<AvatarRecord>("live-avatar", requestId);
    if (!record) {
      // A stop may arrive while read-only preflight is still running, before POST claims the ID.
      if (!await store.writeRecord("live-avatar", requestId, { requestId, state: "cancel_requested", createdAt: new Date().toISOString() })) throw new AvatarError("AVATAR_STOP_RETRY", 409);
      return json({ stopped: true });
    }
    if (record.value.state === "ended") return json({ stopped: true });
    if (record.value.sessionId) await cancelAvatar(record.value.sessionId);
    const state = record.value.sessionId ? "ended" : "cancel_requested";
    if (!await store.writeRecord("live-avatar", requestId, { ...record.value, state }, record.etag)) throw new AvatarError("AVATAR_STOP_RETRY", 409);
    return json({ stopped: true });
  } catch (e) { return errorResponse(e); }
}
