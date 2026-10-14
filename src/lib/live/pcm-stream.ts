import { PCM_SAMPLE_RATE } from "./audio-format";

/** Signed little-endian PCM may be split between either byte of a sample. */
export class PcmDecoder {
  private lowByte: number | undefined;
  decode(bytes: Uint8Array) {
    const samples = new Float32Array(Math.floor((bytes.length + (this.lowByte === undefined ? 0 : 1)) / 2));
    let i = 0, j = 0;
    const sample = (low: number, high: number) => ((high << 24 >> 16) | low) / 32768;
    if (this.lowByte !== undefined && bytes.length) {
      samples[j++] = sample(this.lowByte, bytes[i++]); this.lowByte = undefined;
    }
    while (i + 1 < bytes.length) { samples[j++] = sample(bytes[i], bytes[i + 1]); i += 2; }
    if (i < bytes.length) this.lowByte = bytes[i];
    return samples;
  }
  finish() { if (this.lowByte !== undefined) throw new Error("Megszakadt a hangfolyam."); }
}

/** Schedule incoming samples without waiting for an MP3 decoder's startup buffer. */
export async function playPcmStream(response: Response, context: AudioContext, signal: AbortSignal, onStart?: () => void) {
  signal.throwIfAborted();
  if (!response.body || context.state !== "running") throw new Error("Indítsd újra a hangot a Hangpróba gombbal.");
  const reader = response.body.getReader(), decoder = new PcmDecoder();
  const startedAt = performance.now();
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
  const sources = new Set<AudioBufferSourceNode>();
  let nextAt = context.currentTime, bytes = 0, ended = false, settled = false;
  let announced = false, startTimer: ReturnType<typeof setTimeout> | undefined;
  let firstBytesMs: number | undefined;
  let resolveDone!: () => void, rejectDone!: (error: unknown) => void;
  const done = new Promise<void>((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
  const finish = (error?: unknown) => {
    if (settled) return;
    settled = true;
    error ? rejectDone(error) : resolveDone();
  };
  const stopSources = () => {
    clearTimeout(startTimer);
    for (const source of sources) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); }
    sources.clear();
  };
  const abort = () => { stopSources(); void reader.cancel().catch(() => {}); finish(bounded.reason); };
  const stateChanged = () => {
    if (context.state !== "running") { stopSources(); void reader.cancel().catch(() => {}); finish(new Error("A böngésző szüneteltette a hangot. Indítsd újra a műsort.")); }
  };
  bounded.addEventListener("abort", abort, {once:true});
  context.addEventListener("statechange", stateChanged);
  if (bounded.aborted) abort();
  void (async () => {
    try {
      while (!settled) {
        bounded.throwIfAborted();
        const chunk = await reader.read();
        if (settled) return;
        if (chunk.done) break;
        if (firstBytesMs === undefined) firstBytesMs = Math.round(performance.now() - startedAt);
        bytes += chunk.value.byteLength;
        if (bytes > 8_000_000) throw new Error("Túl hosszú hangfolyam.");
        const samples = decoder.decode(chunk.value);
        if (!samples.length) continue;
        const buffer = context.createBuffer(1, samples.length, PCM_SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
        const at = Math.max(nextAt, context.currentTime + 0.04);
        nextAt = at + buffer.duration;
        sources.add(source);
        source.onended = () => { sources.delete(source); source.disconnect(); if (ended && !sources.size) finish(); };
        source.start(at);
        if (!announced) {
          // Do not report leading digital silence as speech. This is a browser
          // playback estimate, not a measurement at the TikTok viewer's device.
          const firstSound = samples.findIndex(sample => Math.abs(sample) > 0.002);
          if (firstSound >= 0) {
            announced = true;
            const delay = at - context.currentTime + firstSound / PCM_SAMPLE_RATE + (context.outputLatency || 0) + (context.baseLatency || 0);
            console.info("live_audio_client", {format:"pcm",firstBytesMs,scheduleMs:Math.round((at-context.currentTime)*1000),silenceMs:Math.round(firstSound/PCM_SAMPLE_RATE*1000),deviceMs:Math.round(((context.outputLatency||0)+(context.baseLatency||0))*1000)});
            startTimer = setTimeout(() => { if (!settled && !bounded.aborted && context.state === "running") onStart?.(); }, Math.max(0, delay * 1000));
          }
        }
      }
      decoder.finish();
      if (!bytes) throw new Error("Üres hangfolyam.");
      ended = true;
      if (!sources.size) finish();
    } catch (error) { stopSources(); finish(error); }
  })();
  try { await done; }
  finally {
    stopSources(); bounded.removeEventListener("abort", abort); context.removeEventListener("statechange", stateChanged);
    await reader.cancel().catch(() => {});
  }
}
