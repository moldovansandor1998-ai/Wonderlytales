import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DjDirector, nextDjTrack, normalizeDjMood, type MusicTrack } from "@/lib/live/dj";
import { DjMixer } from "@/lib/live/dj-mixer";

const tracks: MusicTrack[] = [
  { id: "a", title: "Alap", mood: "groove", url: "blob:a" },
  { id: "b", title: "Buli", mood: "party", url: "blob:b" },
  { id: "c", title: "Szabad", mood: "any", url: "blob:c" },
];
describe("show-driven DJ", () => {
  it("preserves existing saved mood tags and migrates alternate names", () => {
    for (const mood of ["chill", "groove", "banter", "party", "drama"] as const) expect(normalizeDjMood(mood)).toBe(mood);
    expect(normalizeDjMood("hype")).toBe("party"); expect(normalizeDjMood("calm")).toBe("chill"); expect(normalizeDjMood("playful")).toBe("banter");
    expect(normalizeDjMood("invalid")).toBe("any");
  });
  it("keeps the upstream Hungarian cues and settles after a quiet period", () => {
    let now=0;const director=new DjDirector(()=>now);
    director.event({id:"1",type:"comment",user:"Néző",text:"Ma szomorú vagyok",count:1},false,1);
    expect(director.current).toBe("chill");now=24000;expect(director.current).toBe("groove");
    director.emotion("neutral","Isti ideges és duzzog");expect(director.current).toBe("banter");
    now=60000;expect(director.current).toBe("chill");
  });
  it("holds the music-gift punchline above ordinary speech and then returns to calm", () => {
    let now = 1000; const director = new DjDirector(() => now);
    director.event({ id: "1", type: "gift", user: "Néző", text: "", count: 1 }, true, 4);
    director.emotion("laugh"); expect(director.current).toBe("drama");
    now += 23000; expect(director.current).toBe("groove");
    director.emotion("laugh"); expect(director.current).toBe("party");
    director.reset(); expect(director.current).toBe("groove");
  });
  it("raises energy for a busy comment queue without treating text as a paid gift", () => {
    const director = new DjDirector();
    director.event({ id: "1", type: "comment", user: "Néző", text: "Zene", count: 1 }, false, 1);
    expect(director.current).toBe("groove");
    director.event({ id: "2", type: "comment", user: "Néző", text: "Szia", count: 1 }, false, 3);
    expect(director.current).toBe("party");
  });
  it("prefers a matching mood and never repeats or invents an unavailable track", () => {
    expect(nextDjTrack(tracks, new Set(), "party")?.id).toBe("b");
    expect(nextDjTrack(tracks, new Set(["b"]), "party")?.id).toBe("c");
    expect(nextDjTrack(tracks, new Set(["b"]), "party", true)).toBeUndefined();
    expect(nextDjTrack(tracks, new Set(["a", "b", "c"]), "groove")).toBeUndefined();
  });
});

class Parameter {
  value = 0;
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  cancelScheduledValues = vi.fn();
}
class Node {
  gain = new Parameter(); frequency = new Parameter(); connect = vi.fn(); disconnect = vi.fn();
}
class FakeContext {
  static instances: FakeContext[] = [];
  gains: Node[] = []; state = "running"; currentTime = 0; destination = {};
  constructor() { FakeContext.instances.push(this); }
  createGain() { const node = new Node(); this.gains.push(node); return node; }
  createMediaElementSource() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
}
class FakeAudio {
  static instances: FakeAudio[] = [];
  src = ""; preload = ""; paused = true; ended = false; duration = 120; currentTime = 0; error = null;
  constructor() { FakeAudio.instances.push(this); }
  play = vi.fn(async () => { this.paused = false; this.currentTime = 0; this.ended = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn(); load = vi.fn();
}
describe("two-deck playback", () => {
  let mixer: DjMixer, changed: ReturnType<typeof vi.fn>, error: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers(); FakeAudio.instances = []; FakeContext.instances = [];
    vi.stubGlobal("Audio", FakeAudio); vi.stubGlobal("AudioContext", FakeContext);
    changed = vi.fn(); error = vi.fn(); mixer = new DjMixer(changed, error);
    mixer.configure(tracks, "groove", true, 0.4, false);
  });
  afterEach(() => { mixer.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("keeps the outgoing deck playing throughout the crossfade", async () => {
    await mixer.play(tracks[0]); await vi.advanceTimersByTimeAsync(400);
    await mixer.play(tracks[1]);
    expect(FakeAudio.instances.map(a => a.paused)).toEqual([false, false]);
    await vi.advanceTimersByTimeAsync(2600);
    expect(FakeAudio.instances.map(a => a.paused)).toEqual([true, false]);
    expect(await mixer.play(tracks[0])).toBe(false);
  });
  it("does not change tracks for mood before 30 seconds", async () => {
    await mixer.play(tracks[0]); mixer.configure(tracks, "party", true, 0.4, false);
    await vi.advanceTimersByTimeAsync(29000); expect(changed).toHaveBeenLastCalledWith(tracks[0]);
    await vi.advanceTimersByTimeAsync(1500); expect(changed).toHaveBeenLastCalledWith(tracks[1]);
  });
  it("leaves a universal song alone when the mood changes", async () => {
    await mixer.play(tracks[2]); mixer.configure(tracks, "party", true, 0.4, false);
    await vi.advanceTimersByTimeAsync(31000); expect(changed).toHaveBeenCalledTimes(1);
  });
  it("starts the next song just before the active song ends", async () => {
    await mixer.play(tracks[0]); await vi.advanceTimersByTimeAsync(400);
    FakeAudio.instances[0].currentTime = 118;
    await vi.advanceTimersByTimeAsync(300); expect(changed).toHaveBeenLastCalledWith(tracks[2]);
  });
  it("keeps the old song if the next file fails and excludes that file from retry loops", async () => {
    await mixer.play(tracks[0]); await vi.advanceTimersByTimeAsync(400);
    FakeAudio.instances[1].play.mockRejectedValueOnce(new Error("decode"));
    expect(await mixer.play(tracks[1])).toBe(false);
    expect(FakeAudio.instances[0].paused).toBe(false);
    expect(mixer.played.has("b")).toBe(false); expect(error).toHaveBeenCalledOnce();
    expect(await mixer.play(tracks[1])).toBe(false);
  });
  it("stops both decks and does not resurrect playback from an outstanding play promise", async () => {
    let resolve!: () => void;
    FakeAudio.instances[0].play.mockImplementationOnce(() => new Promise<void>(r => { resolve = r; }));
    const pending = mixer.play(tracks[0]); mixer.stop(); resolve();
    expect(await pending).toBe(false);
    await vi.advanceTimersByTimeAsync(6000);
    expect(FakeAudio.instances.every(a => a.paused)).toBe(true);
    expect(mixer.played.size).toBe(0); expect(changed).toHaveBeenLastCalledWith();
  });
  it("bounds a stalled file load so the next song can play", async () => {
    FakeAudio.instances[0].play.mockImplementationOnce(() => new Promise(() => {}));
    const pending = mixer.play(tracks[0]); await vi.advanceTimersByTimeAsync(10100);
    expect(await pending).toBe(false); expect(error).toHaveBeenCalledOnce();
    expect(await mixer.play(tracks[1])).toBe(true);
  });
  it("ducks both decks through one gain and restores gradually", () => {
    const gain = FakeContext.instances[0].gains[0].gain;
    mixer.configure(tracks, "party", true, 0.5, true);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.08, 0, 0.08);
    mixer.configure(tracks, "party", true, 0.5, false);
    expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(0.5, 0, 0.45);
  });
  it("repeats the only uploaded song after its end without overlapping it early", async () => {
    mixer.configure([tracks[0]], "groove", true, 0.4, false);
    await mixer.play(tracks[0]); await vi.advanceTimersByTimeAsync(400);
    FakeAudio.instances[0].currentTime = 118;
    await vi.advanceTimersByTimeAsync(300); expect(changed).toHaveBeenCalledTimes(1);
    FakeAudio.instances[0].ended = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(changed.mock.calls.map(([track])=>track?.id)).toEqual(["a","a"]);
    expect(FakeAudio.instances[1].src).toBe("blob:a");
  });
  it("plays the complete uploaded playlist, then starts again at the first file", async () => {
    const songs=tracks.map(track=>({...track,mood:"any" as const}));
    mixer.configure(songs,"groove",true,0.4,false);mixer.start();
    for(let index=0;index<3;index++){
      await vi.advanceTimersByTimeAsync(3000);
      FakeAudio.instances[index%2].ended=true;
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(changed.mock.calls.map(([track])=>track?.id)).toEqual(["a","b","c","a"]);
    expect([...mixer.played]).toEqual(["a"]);
    mixer.stop();const calls=changed.mock.calls.length;
    await vi.advanceTimersByTimeAsync(3000);expect(changed).toHaveBeenCalledTimes(calls);
  });
  it("does not retry failed files forever or invent music for an empty library", async () => {
    mixer.configure([],"groove",true,0.4,false);mixer.start();
    await vi.advanceTimersByTimeAsync(1000);expect(changed).not.toHaveBeenCalled();
    mixer.configure([tracks[0]],"groove",true,0.4,false);
    FakeAudio.instances[0].play.mockRejectedValue(new Error("decode"));
    await vi.advanceTimersByTimeAsync(3000);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledOnce();expect(changed).not.toHaveBeenCalled();
  });
});
