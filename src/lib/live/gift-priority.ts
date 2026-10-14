import type { LiveEvent } from "./events";

/** Play at most two gifts while the same comment request continues in the background. */
export class GiftPriority {
  private wake?: () => void;
  private playingComment?: AbortController;
  notify() { this.playingComment?.abort(new GiftInterruption()); this.wake?.(); }

  /** Settle the interrupted playback cleanup before the queue starts its gift. */
  async playComment<T>(controller: AbortController, play: () => Promise<T>) {
    controller.signal.throwIfAborted();this.playingComment=controller;
    try {return await play();}
    finally {if(this.playingComment===controller)this.playingComment=undefined;}
  }

  async during<T>(preparing: Promise<T>, signal: AbortSignal, takeGift: () => LiveEvent | undefined, play: (event: LiveEvent) => Promise<void>): Promise<T> {
    let settled = false;
    // Capture rejection immediately, even while a gift is playing or Stop is pressed.
    const outcome = preparing.then(value => ({ok:true as const,value}), error => ({ok:false as const,error})).then(result => { settled = true; return result; });
    let count = 0;
    while (count < 2) {
      signal.throwIfAborted();
      const gift = takeGift();
      if (gift) { await play(gift); count++; continue; }
      if (settled) break;
      let wake!: () => void;
      const changed = new Promise<void>(resolve => { wake = resolve; this.wake = resolve; });
      signal.addEventListener("abort", wake, {once:true});
      try { if (!signal.aborted) await Promise.race([outcome, changed]); }
      finally { signal.removeEventListener("abort", wake); if (this.wake === wake) this.wake = undefined; }
    }
    signal.throwIfAborted();
    // Abort must also release the wait after the two-gift fairness limit.
    let abort!: () => void;
    const stopped = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); });
    signal.addEventListener("abort", abort, {once:true});
    try {
      if (signal.aborted) abort();
      const result = await Promise.race([outcome, stopped]);
      if (!result.ok) throw result.error;
      return result.value;
    } finally { signal.removeEventListener("abort", abort); }
  }
}

export class GiftInterruption extends Error {
  constructor(){super("Ajándék érkezett; a kommentválasz megszakítva.");this.name="GiftInterruption";}
}
