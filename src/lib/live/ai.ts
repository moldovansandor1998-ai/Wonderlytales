import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { json } from "@/lib/ai-video/http";
import type { z } from "zod";

export function liveAiProvider(): "story" | "wavespeed" | null {
  if (process.env.STORY_API_KEY) return "story";
  return process.env.WAVESPEED_API_KEY ? "wavespeed" : null;
}

function parseReply<T>(content: unknown, schema: z.ZodType<T>) {
  try {
    const text = typeof content === "string" ? content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : content;
    const parsed = schema.safeParse(typeof text === "string" ? JSON.parse(text) : text);
    return parsed.success ? json(parsed.data) : json({ error: "AI_INVALID_REPLY" }, 502);
  } catch { return json({ error: "AI_INVALID_REPLY" }, 502); }
}

/** One paid submission per event; subsequent WaveSpeed requests only retrieve that task. */
export async function generateLiveReply<T>(messages: {role: string; content: string}[], schema: z.ZodType<T>, signal: AbortSignal, maxTokens: number) {
  const provider = liveAiProvider();
  if (!provider) return json({ error: "AI_NOT_CONFIGURED" }, 503);
  signal.throwIfAborted();
  if (provider === "wavespeed") {
    // Any LLM has a documented flat $0.01/run price. Keep the existing ledger's ceiling adequate.
    const budget = await getProductionBudget();
    if (budget && !(budget.configured_services.story >= 0.01)) return json({ error: "AI_BUDGET_NOT_CONFIGURED" }, 503);
  }
  await reserveProductionBudget("story");
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
  const key = provider === "story" ? process.env.STORY_API_KEY! : process.env.WAVESPEED_API_KEY!;
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    if (provider === "story") {
      const response = await fetch(`${(process.env.STORY_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
        method: "POST", headers,
        body: JSON.stringify({ model: process.env.STORY_MODEL || "gpt-4o", messages, response_format: { type: "json_object" }, max_tokens: maxTokens }),
        signal: bounded,
      });
      if (!response.ok) return json({ error: "AI_PROVIDER_ERROR" }, 502);
      const data = await response.json();
      if (data.error || data.choices?.[0]?.finish_reason === "length") return json({ error: "AI_INVALID_REPLY" }, 502);
      return parseReply(data.choices?.[0]?.message?.content, schema);
    }
    const base = "https://api.wavespeed.ai/api/v3";
    const submitted = await fetch(`${base}/wavespeed-ai/any-llm`, {
      method: "POST", headers, signal: bounded,
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-lite", system_prompt: messages.filter(m => m.role === "system").map(m => m.content).join("\n"),
        prompt: messages.filter(m => m.role !== "system").map(m => m.content).join("\n"),
        max_tokens: Math.max(maxTokens, 700), temperature: 0.85, enable_sync_mode: true,
      }),
    });
    if (!submitted.ok) return json({ error: "AI_PROVIDER_ERROR" }, 502);
    let body = await submitted.json();
    let task = body.data || body;
    const taskId = task.id;
    while (!bounded.aborted) {
      if (body.error || task.error || ["failed", "cancelled", "timeout", "deleted"].includes(task.status)) return json({ error: "AI_PROVIDER_ERROR" }, 502);
      if (task.status === "completed") return parseReply(task.outputs?.[0], schema);
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(taskId || "") || !["created", "pending", "processing", "in_queue", "running"].includes(task.status)) return json({ error: "AI_INVALID_REPLY" }, 502);
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); bounded.removeEventListener("abort", abort); reject(bounded.reason); };
        const timer = setTimeout(() => { bounded.removeEventListener("abort", abort); resolve(); }, 700);
        bounded.addEventListener("abort", abort, { once: true });
        if (bounded.aborted) abort();
      });
      const response = await fetch(`${base}/predictions/${encodeURIComponent(taskId)}/result`, { headers, signal: bounded, cache: "no-store" });
      if (!response.ok) return json({ error: "AI_PROVIDER_ERROR" }, 502);
      body = await response.json(); task = body.data || body;
    }
    return json({ error: "AI_TIMEOUT" }, 504);
  } catch {
    return json({ error: bounded.aborted ? "AI_TIMEOUT" : "AI_PROVIDER_ERROR" }, bounded.aborted ? 504 : 502);
  }
}
