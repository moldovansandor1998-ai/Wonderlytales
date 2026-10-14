/** Incremental playback on supporting browsers; same-response blob fallback elsewhere. */
export async function playMp3Stream(response: Response, signal: AbortSignal, play: (url: string, signal: AbortSignal) => Promise<void>) {
  if (!response.body) throw new Error("Üres hangfolyam.");
  if (typeof MediaSource === "undefined" || !MediaSource.isTypeSupported("audio/mpeg")) {
    const blob = await response.blob(); signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    try { await play(url, signal); } finally { URL.revokeObjectURL(url); }
    return;
  }
  const controller = new AbortController();
  const bounded = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(45000)]);
  const source = new MediaSource(), reader = response.body.getReader();
  const url = URL.createObjectURL(source);
  const wait = (target: EventTarget, event: string) => new Promise<void>((resolve, reject) => {
    const clean = () => { target.removeEventListener(event, done); target.removeEventListener("error", fail); bounded.removeEventListener("abort", abort); };
    const done = () => { clean(); resolve(); };
    const fail = () => { clean(); reject(new Error("Megszakadt a hangfolyam.")); };
    const abort = () => { clean(); reject(bounded.reason); };
    target.addEventListener(event, done, {once:true}); target.addEventListener("error", fail, {once:true}); bounded.addEventListener("abort", abort, {once:true});
    if (bounded.aborted) abort();
  });
  const cancel = () => { void reader.cancel().catch(() => {}); };
  bounded.addEventListener("abort", cancel, {once:true});
  const pump = async () => {
    await wait(source, "sourceopen");
    const buffer = source.addSourceBuffer("audio/mpeg");
    let bytes = 0;
    while (true) {
      bounded.throwIfAborted();
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 8_000_000) throw new Error("Túl hosszú hangfolyam.");
      const appended = wait(buffer, "updateend");
      try { buffer.appendBuffer(chunk.value); } catch (error) { controller.abort(); await appended.catch(() => {}); throw error; }
      await appended;
    }
    if (!bytes) throw new Error("Üres hangfolyam.");
    if (source.readyState === "open") source.endOfStream();
  };
  try { await Promise.all([pump(), play(url, bounded)]); }
  finally { controller.abort(); bounded.removeEventListener("abort", cancel); await reader.cancel().catch(() => {}); URL.revokeObjectURL(url); }
}
