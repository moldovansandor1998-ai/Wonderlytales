import { describe, expect, it, vi } from "vitest";
import { airDialogue } from "@/lib/live/show";
import type { Dialogue } from "@/lib/live/duo";
const dialogue: Dialogue = { turns: [{ speaker: "ali", text: "Szia!", emotion: "happy" }, { speaker: "isti", text: "Hallak!", emotion: "neutral" }] };
const voices = { ali: "AliVoice", isti: "IstiVoice" };
describe("Autonomous live playout", () => {
  it("prepares both responses concurrently and waits for Ali playback before Isti", async () => {
    const order: string[] = [];
    let releaseAli!: () => void;
    const gate = new Promise<void>(resolve => { releaseAli = resolve; });
    const prepare = vi.fn(async turn => { order.push(`prepare:${turn.speaker}`); return { url: `/${turn.speaker}`, requestId: turn.speaker }; });
    const play = vi.fn(async (_clip, turn) => { order.push(`play:${turn.speaker}`); if (turn.speaker === "ali") await gate; });
    const run = airDialogue(dialogue, voices, new AbortController().signal, prepare, play);
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(order).toEqual(["prepare:ali", "prepare:isti", "play:ali"]);
    releaseAli(); await run;
    expect(order.at(-1)).toBe("play:isti"); expect(play).toHaveBeenCalledTimes(2);
  });
  it("cancels the other generation on a provider failure without airing a partial dialogue", async () => {
    const signals: AbortSignal[] = [];
    const prepare = vi.fn(async (turn, _voice, signal) => { signals.push(signal); if (turn.speaker === "ali") throw new Error("provider"); return { url: "/isti", requestId: "isti" }; });
    const play = vi.fn();
    await expect(airDialogue(dialogue, voices, new AbortController().signal, prepare, play)).rejects.toThrow("provider");
    expect(signals.every(s => s.aborted)).toBe(true); expect(play).not.toHaveBeenCalled(); expect(prepare).toHaveBeenCalledTimes(2);
  });
  it("stop during preparation prevents later automatic playback", async () => {
    const controller = new AbortController(); let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    const signals: AbortSignal[] = [];
    const prepare = vi.fn(async (turn, _voice, signal) => { signals.push(signal); await gate; return { url: `/${turn.speaker}`, requestId: turn.speaker }; });
    const play = vi.fn(); const run = airDialogue(dialogue, voices, controller.signal, prepare, play);
    const result = expect(run).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();finish(); await result;
    expect(signals.every(s => s.aborted)).toBe(true); expect(play).not.toHaveBeenCalled();
  });
  it("does not spend when already stopped or either voice is missing", async () => {
    const prepare = vi.fn(), play = vi.fn(), controller = new AbortController();controller.abort();
    await expect(airDialogue(dialogue, voices, controller.signal, prepare, play)).rejects.toMatchObject({ name: "AbortError" });
    await expect(airDialogue(dialogue, { ...voices, isti: "" }, new AbortController().signal, prepare, play)).rejects.toThrow("Mindkét");
    expect(prepare).not.toHaveBeenCalled();
  });
});
