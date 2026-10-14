import type { Emotion, LiveEvent } from "./events";
import { MusicDirector, MUSIC_MOODS, type MusicMood } from "./music-director";

export const DJ_MOODS = {
  ...MUSIC_MOODS,
  drama: { label: "Isti kiakad", bpm: 112 },
} as const;
export type DjMood = keyof typeof DJ_MOODS;
export type MusicTrack = { id: string; title: string; url: string; mood: DjMood | "any" };

/** Short reactions expire. Ordinary comments cannot cancel the gift punchline. */
export class DjDirector {
  private director = new MusicDirector();
  private dramaUntil = 0;
  constructor(private now = Date.now) { this.director.start(now()); }
  get current(): DjMood {
    return this.now() < this.dramaUntil ? "drama" : this.director.mood(this.now());
  }
  cue(mood: DjMood, seconds = 18, priority = 1) {
    if (mood === "drama") { this.dramaUntil = this.now() + seconds * 1000; return; }
    if (this.current === "drama" && priority < 3) return;
    this.dramaUntil = 0;
    this.director.set(mood as MusicMood, this.now(), priority, seconds * 1000);
  }
  event(event: LiveEvent, musicGift: boolean, queueSize: number) {
    this.director.event(event, musicGift, this.now());
    if (musicGift) this.cue("drama", 14, 3);
    else if (queueSize >= 3 && event.type === "comment") this.cue("party", 12, 1);
    else if (event.type === "follow") this.cue("banter");
  }
  emotion(emotion: Emotion, text = "") {
    this.director.reaction(emotion, text, this.now());
  }
  reset() { this.dramaUntil = 0; this.director.start(this.now()); }
}

/** Preserve tags saved by either of the two earlier DJ versions. */
export function normalizeDjMood(value: unknown): MusicTrack["mood"] {
  if (value === "calm") return "chill";
  if (value === "playful") return "banter";
  if (value === "hype") return "party";
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(DJ_MOODS, value) ? value as DjMood : "any";
}

export function nextDjTrack(tracks: MusicTrack[], unavailable: ReadonlySet<string>, mood: DjMood, exactOnly = false) {
  const candidates = tracks.filter(t => !unavailable.has(t.id));
  return candidates.find(t => t.mood === mood) || (exactOnly ? undefined : candidates.find(t => t.mood === "any") || candidates[0]);
}
