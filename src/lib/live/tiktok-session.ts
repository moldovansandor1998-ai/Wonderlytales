import { randomUUID } from "node:crypto";
import { R2VideoStore } from "@/lib/ai-video/storage";

const ID = "00000000-0000-4000-8000-000000000001";
type Lease = { token:string; expiresAt:number; lastAttempt:number };
/** One active upstream connection per Studio owner, including across instances. */
export async function claimTikTokSession(ownerId:string) {
  const store = new R2VideoStore(ownerId);
  const current = await store.readRecord<Lease>("live-chat", ID);
  const now = Date.now();
  if (current && (current.value.expiresAt > now || now-current.value.lastAttempt < 5000)) return null;
  const token = randomUUID();
  if (!await store.writeRecord("live-chat", ID, {token, expiresAt:now+280000, lastAttempt:now}, current?.etag)) return null;
  return async () => {
    const saved = await store.readRecord<Lease>("live-chat", ID);
    if (saved?.value.token === token) await store.writeRecord("live-chat", ID, {...saved.value, expiresAt:0}, saved.etag);
  };
}
