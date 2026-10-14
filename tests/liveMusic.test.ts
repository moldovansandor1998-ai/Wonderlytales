import { describe, expect, it } from "vitest";
import { MusicDirector, nextDjTrack } from "@/lib/live/music-director";
import type { LiveEvent } from "@/lib/live/events";
const comment = (text: string): LiveEvent => ({ id: text, type: "comment", text, user: "Néző", count: 1 });
const gift: LiveEvent = { id: "gift", type: "gift", gift: "Zene", text: "", user: "Néző", count: 1 };
describe("Live DJ direction", () => {
  it("follows Hungarian chat cues and returns to a calm bed during silence", () => {
    const dj = new MusicDirector(); dj.start(0);
    expect(dj.mood(0)).toBe("groove");
    dj.event(comment("Isti ideges vagy?"), false, 1000);
    expect(dj.mood(1000)).toBe("banter");
    dj.event(comment("Ma szomorú vagyok"), false, 1200);
    expect(dj.mood(1200)).toBe("chill");
    dj.event(comment("Buli van!"), false, 1500);
    expect(dj.mood(1500)).toBe("chill");
    expect(dj.mood(26000)).toBe("groove");
    expect(dj.mood(48000)).toBe("chill");
  });
  it("holds the gift scene through Isti's angry line and rate-limits repeated accents", () => {
    const dj = new MusicDirector(); dj.start(0);
    expect(dj.event(gift, true, 100)).toBe(true);
    dj.reaction("neutral", "Ideges vagyok!", 1000);
    expect(dj.mood(1000)).toBe("party");
    expect(dj.event(gift, true, 2000)).toBe(false);
    expect(dj.event(gift, true, 9000)).toBe(true);
    expect(dj.mood(30000)).toBe("party");
    expect(dj.mood(32000)).toBe("groove");
  });
  it("does not mistake a music comment for a gift and reacts to busy chat", () => {
    const dj = new MusicDirector(); dj.start(0);
    expect(dj.event(comment("zene"), false, 100)).toBe(false);
    expect(dj.mood(100)).toBe("groove");
    for(let i=1;i<5;i++)dj.event(comment(`szia ${i}`),false,100+i*500);
    expect(dj.mood(2100)).toBe("party");
  });
  it("keeps a scene stable for at least eight seconds and starts a new show cleanly", () => {
    const dj = new MusicDirector(); dj.start(0);
    dj.event(comment("duzzog"), false, 1000);
    dj.event(comment("haha"), false, 2000);
    expect(dj.mood(2000)).toBe("banter");
    dj.event(comment("haha"), false, 10000);
    expect(dj.mood(10000)).toBe("party");
    dj.start(11000);expect(dj.mood(11000)).toBe("groove");
  });
  it("selects a matching unused track, preserves untagged fallback, and exhausts without repeats", () => {
    const tracks = [{id:"calm",mood:"chill" as const},{id:"any",mood:"any" as const},{id:"party",mood:"party" as const}];
    const used = new Set<string>();
    expect(nextDjTrack(tracks,used,"party")?.id).toBe("party");used.add("party");
    expect(nextDjTrack(tracks,used,"party")?.id).toBe("any");used.add("any");
    expect(nextDjTrack(tracks,used,"party")?.id).toBe("calm");used.add("calm");
    expect(nextDjTrack(tracks,used,"party")).toBeUndefined();
  });
});
