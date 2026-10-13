import { reserveProductionBudget } from "@/lib/budget";
import { json } from "@/lib/ai-video/http";
import type { z } from "zod";
import { getVercelOidcToken } from "@vercel/oidc";

// Pin the model to the price verified for the live_ai reservation; a model change
// must also recheck that ceiling. Read OIDC inside each request, never at import.
export const LIVE_MODEL = "openai/gpt-4.1-mini";
export function liveAIConfiguration() {
  const gateway = process.env.LIVE_AI_GATEWAY_ENABLED === "true";
  return { configured: gateway ? !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) : !!process.env.STORY_API_KEY,
    model: gateway ? LIVE_MODEL : process.env.STORY_MODEL || "gpt-4o" };
}

export async function generateLiveReply<T>(messages: {role: string; content: string}[], schema: z.ZodType<T>, signal: AbortSignal, maxTokens: number) {
  const gateway = process.env.LIVE_AI_GATEWAY_ENABLED === "true";
  if (Buffer.byteLength(JSON.stringify(messages), "utf8") > 20000 || maxTokens > 800) return json({ error: "AI_INPUT_TOO_LARGE" }, 400);
  signal.throwIfAborted();
  const key = gateway ? process.env.AI_GATEWAY_API_KEY || await getVercelOidcToken().catch(() => undefined) : process.env.STORY_API_KEY;
  if (!key) return json({ error: "AI_NOT_CONFIGURED" }, 503);
  await reserveProductionBudget(gateway ? "live_ai" : "story");
  const base = gateway ? "https://ai-gateway.vercel.sh/v1" : process.env.STORY_BASE_URL || "https://api.openai.com/v1";
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: liveAIConfiguration().model, messages, response_format: { type: "json_object" }, max_tokens: maxTokens }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const code = failure?.error?.code || failure?.error?.type;
    const error = code === "customer_verification_required" ? "AI_VERIFICATION_REQUIRED"
      : response.status === 402 ? "AI_CREDITS_REQUIRED" : response.status === 401 || response.status === 403 ? "AI_ACCESS_DENIED"
      : response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_ERROR";
    // Never return provider bodies: they may contain configuration or prompt data.
    console.warn("live_ai_provider_error", { status: response.status, code: error });
    return json({ error }, 502);
  }
  const data = await response.json();
  let reply: unknown;
  try { reply = JSON.parse(data.choices?.[0]?.message?.content || ""); } catch { return json({ error: "AI_INVALID_REPLY" }, 502); }
  const parsed = schema.safeParse(reply);
  if (!parsed.success) return json({ error: "AI_INVALID_REPLY" }, 502);
  console.info("live_ai_reply", { model: liveAIConfiguration().model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens });
  return json(parsed.data);
}
