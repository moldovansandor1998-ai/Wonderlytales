import type { LiveEvent } from "./events";

export const NPC_IMAGE = "/live-studio/ali-isti-masked.webp";
export const NPC_KINDS = ["idle-breathe", "idle-glance", "idle-shrug", "music-gift"] as const;
export type NpcKind = typeof NPC_KINDS[number];
export const MUSIC_GIFT_LINE = "Ne dobd azt a szart, a kurva anyád!";
export const DEFAULT_MUSIC_GIFTS = "Zene, Music, Music Note, Musical Notes";
export const normalizeGift = (value: string) => value.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ");
/** Exact names/IDs only: comments or unrelated gifts must never trigger a paid-gift reaction. */
export function isMusicGift(event: LiveEvent, names = DEFAULT_MUSIC_GIFTS, giftId = "") {
  if (event.type !== "gift") return false;
  if (giftId.trim()) return event.giftId === giftId.trim();
  const allowed = names.split(",").map(normalizeGift).filter(Boolean);
  return !!event.gift && allowed.includes(normalizeGift(event.gift));
}
export type NpcManifest = { clips: {kind: NpcKind; status: string; url?: string}[]; voice: {status: string; url?: string}; ready: boolean };
