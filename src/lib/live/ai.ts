import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { json } from "@/lib/ai-video/http";
import type { z } from "zod";
import { getVercelOidcToken } from "@vercel/oidc";
import { readCompletionStream } from "./completion-stream";

export const LIVE_MODEL = "openai/gpt-6.1-sol";
export const LIVE_STREAM_MODEL = "openai/gpt-6-luna";
// 20,000 input bytes + framing, including $2.50/M cache writes, and
// <=800 combined reasoning/output tokens at $10/M in standard processing.
export const LIVE_AI_RESERVATION_USD = 0.06;
// Streaming Luna priority: <=8,000 UTF-8 bytes + framing at <=$0.275/M cache
// writes, <=800 output tokens at <=$1.10/M, below the $0.06 reservation.
export const LIVE_FAST_INPUT_BYTES = 8000;
type LiveTextStream = {onText:(text:string)=>Promise<void>; toReply:(text:string)=>unknown};

export function liveAiProvider(): "gateway" | "story" | "wavespeed" | null {
  if (process.env.LIVE_AI_GATEWAY_ENABLED === "true") return "gateway";
  if (process.env.STORY_API_KEY) return "story";
  return process.env.WAVESPEED_API_KEY ? "wavespeed" : null;
}

export function liveAIConfiguration() {
  const provider = liveAiProvider();
  return { configured: provider === "gateway" ? !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) : !!provider,
    provider, model: provider === "gateway" ? LIVE_STREAM_MODEL : provider === "wavespeed" ? "google/gemini-3.1-flash-lite" : process.env.STORY_MODEL || "gpt-4o" };
}

function parseReply<T>(content: unknown, schema: z.ZodType<T>) {
  try {
    const text = typeof content === "string" ? content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "") : content;
    const parsed = schema.safeParse(typeof text === "string" ? JSON.parse(text) : text);
    return parsed.success ? json(parsed.data) : json({ error: "AI_INVALID_REPLY" }, 502);
  } catch { return json({ error: "AI_INVALID_REPLY" }, 502); }
}

/** One paid submission per call; subsequent WaveSpeed requests only retrieve that task. */
export async function generateLiveReply<T>(messages: {role: string; content: string}[], schema: z.ZodType<T>, signal: AbortSignal, maxTokens: number, stream?: LiveTextStream) {
  const startedAt = Date.now();
  const provider = liveAiProvider();
  const model = provider === "gateway" ? (stream ? LIVE_STREAM_MODEL : LIVE_MODEL) : liveAIConfiguration().model;
  if (!provider) return json({ error: "AI_NOT_CONFIGURED" }, 503);
  if (Buffer.byteLength(JSON.stringify(messages), "utf8") > (stream ? LIVE_FAST_INPUT_BYTES : 20000) || maxTokens > 800) return json({ error: "AI_INPUT_TOO_LARGE" }, 400);
  signal.throwIfAborted();
  const key = provider === "gateway" ? process.env.AI_GATEWAY_API_KEY || await getVercelOidcToken().catch(() => undefined) : provider === "story" ? process.env.STORY_API_KEY : process.env.WAVESPEED_API_KEY;
  if (!key) return json({ error: "AI_NOT_CONFIGURED" }, 503);
  if (provider === "gateway" || provider === "wavespeed") {
    // Verify the pinned model's ceiling before reserving or spending.
    const budget = await getProductionBudget();
    const service = provider === "gateway" ? "live_ai" : "story";
    const ceiling = provider === "gateway" ? LIVE_AI_RESERVATION_USD : 0.01;
    if (budget && !(budget.configured_services[service] >= ceiling)) return json({ error: "AI_BUDGET_NOT_CONFIGURED" }, 503);
  }
  await reserveProductionBudget(provider === "gateway" ? "live_ai" : "story");
  const preflightMs = Date.now() - startedAt;
  let firstTextMs: number | undefined;
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  try {
    if (provider !== "wavespeed") {
      const base = provider === "gateway" ? "https://ai-gateway.vercel.sh/v1" : process.env.STORY_BASE_URL || "https://api.openai.com/v1";
      const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST", headers,
        body: JSON.stringify({ model, messages,
          ...(stream ? {stream:true,stream_options:{include_usage:true}} : {response_format:{type:"json_object"}}),
          ...(provider === "gateway" ? {max_completion_tokens:800,reasoning_effort:stream?"none":"low",service_tier:stream?"priority":"default"} : {max_tokens:maxTokens}) }),
        signal: bounded,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        const code = failure?.error?.code || failure?.error?.type;
        const error = code === "customer_verification_required" ? "AI_VERIFICATION_REQUIRED"
          : response.status === 402 ? "AI_CREDITS_REQUIRED" : response.status === 401 || response.status === 403 ? "AI_ACCESS_DENIED"
          : response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR";
        console.warn("live_ai_provider_error", { status: response.status, code: error });
        return json({ error }, 502);
      }
      const data = stream ? await readCompletionStream(response, bounded, async text => {
        if(firstTextMs===undefined)firstTextMs=Date.now()-startedAt;
        await stream.onText(text);
      }) : await response.json();
      if (data.error || data.choices?.[0]?.finish_reason === "length") return json({ error: "AI_INVALID_REPLY" }, 502);
      console.info("live_ai_reply", { durationMs: Date.now() - startedAt, preflightMs, firstTextMs, model, serviceTier:data.service_tier, streamed:!!stream, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens, reasoningTokens:data.usage?.completion_tokens_details?.reasoning_tokens });
      const content = data.choices?.[0]?.message?.content;
      return parseReply(stream && typeof content === "string" ? stream.toReply(content) : content, schema);
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
      if (task.status === "completed") return parseReply(stream ? stream.toReply(task.outputs?.[0] || "") : task.outputs?.[0], schema);
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
  } catch (error) {
    return json({ error: bounded.aborted ? "AI_TIMEOUT" : error instanceof Error && error.message === "AI_INVALID_REPLY" ? "AI_INVALID_REPLY" : "AI_PROVIDER_ERROR" }, bounded.aborted ? 504 : 502);
  }
}
