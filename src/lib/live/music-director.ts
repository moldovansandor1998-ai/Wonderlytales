import type { Emotion, LiveEvent } from "./events";

export type MusicMood = "chill" | "groove" | "banter" | "party";
export const MUSIC_MOODS: Record<MusicMood, { label: string; bpm: number }> = {
  chill: { label: "Nyugodt", bpm: 76 },
  groove: { label: "Laza", bpm: 96 },
  banter: { label: "Csipkelődős", bpm: 104 },
  party: { label: "Buli", bpm: 124 },
};
const plain = (value: string) => value.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Gift holds and a change cooldown keep the soundtrack from jumping every comment. */
export class MusicDirector {
  private cue?: { mood: MusicMood; until: number; priority: number };
  private activeAt = 0;
  private comments: number[] = [];
  private lastChange = -Infinity;
  private lastAccent = -Infinity;
  start(now: number) { this.cue = undefined; this.comments = []; this.activeAt = now; this.lastChange = -Infinity; this.lastAccent = -Infinity; }
  mood(now: number): MusicMood {
    if (this.cue && now < this.cue.until) return this.cue.mood;
    return now - this.activeAt > 45000 ? "chill" : "groove";
  }
  set(mood: MusicMood, now: number, priority = 1, duration = 18000) {
    if (this.cue && now < this.cue.until && (this.cue.priority > priority || (this.cue.mood !== mood && now - this.lastChange < 8000 && priority <= this.cue.priority))) return;
    if (this.mood(now) !== mood) this.lastChange = now;
    this.cue = { mood, until: now + duration, priority };
  }
  event(event: LiveEvent, musicGift: boolean, now: number): boolean {
    this.activeAt = now;
    if (event.type === "gift") {
      this.set("party", now, musicGift ? 3 : 2, musicGift ? 22000 : 12000);
      if (musicGift && now - this.lastAccent >= 8000) { this.lastAccent = now; return true; }
      return false;
    }
    if (event.type !== "comment") return false;
    this.comments = [...this.comments.filter(at => now - at < 12000), now].slice(-6);
    const text = plain(event.text);
    if (/\b(szomoru|szomorusag|gyasz|rossz nap|nyugi|nyugodt|lassu)\b/.test(text)) this.set("chill", now, 2, 22000);
    else if (/\b(duzzog|ideges|adoztok|dagadt|beszol|puffog)\b/.test(text)) this.set("banter", now);
    else if (/\b(buli|tanc|porog|hajra|haha|lol)\b|😂|🤣|🔥/.test(text) || this.comments.length >= 5) this.set("party", now);
    return false;
  }
  reaction(emotion: Emotion, text: string, now: number) {
    if (/duzzog|ideges|adoztok|dagadt|puffog/.test(plain(text))) this.set("banter", now, 0, 12000);
    else if (emotion === "laugh" || emotion === "happy" || emotion === "thanks") this.set("party", now, 0, 12000);
  }
}

/** Prefer matching moods, then untagged music, without replaying consumed tracks. */
export function nextDjTrack<T extends { id: string; mood: MusicMood | "any" }>(tracks: T[], played: Set<string>, mood: MusicMood): T | undefined {
  const available = tracks.filter(track => !played.has(track.id));
  return available.find(track => track.mood === mood) || available.find(track => track.mood === "any") || available[0];
}
