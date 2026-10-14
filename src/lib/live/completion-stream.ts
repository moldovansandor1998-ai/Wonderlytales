/** Consume only public text deltas. Reasoning and provider details never reach speech. */
export async function readCompletionStream(response: Response, signal: AbortSignal, onText: (text: string) => Promise<void>) {
  if (!response.body) throw new Error("AI_PROVIDER_ERROR");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = "", text = "", finished = false, usage: Record<string, any> | undefined, tier: string | undefined;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, {once:true});
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      pending += decoder.decode(chunk.value, {stream:!chunk.done});
      if (pending.length > 100000) throw new Error("AI_PROVIDER_ERROR");
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/u.exec(pending))) {
        const frame = pending.slice(0, boundary.index); pending = pending.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (!data) continue;
        if (data === "[DONE]") { finished = true; continue; }
        if (finished) throw new Error("AI_PROVIDER_ERROR");
        const value = JSON.parse(data);
        if (value.error) throw new Error("AI_PROVIDER_ERROR");
        const choice = value.choices?.[0];
        if (choice?.finish_reason && choice.finish_reason !== "stop") throw new Error("AI_INVALID_REPLY");
        if (value.usage) usage = value.usage;
        tier = value.service_tier || value.provider_metadata?.gateway?.serviceTier || tier;
        const delta = choice?.delta?.content;
        if (typeof delta === "string" && delta) {
          text += delta;
          if (text.length > 2000) throw new Error("AI_INVALID_REPLY");
          await onText(text);
        }
      }
      if (chunk.done) break;
    }
    signal.throwIfAborted();
    if (!finished || !text.trim() || pending.trim()) throw new Error("AI_INVALID_REPLY");
    return {choices:[{message:{content:text}}], usage, service_tier:tier};
  } finally {
    signal.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => {});
  }
}
