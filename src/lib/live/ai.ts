import { reserveProductionBudget } from "@/lib/budget";
import { json } from "@/lib/ai-video/http";
import type { z } from "zod";

export async function generateLiveReply<T>(messages: {role: string; content: string}[], schema: z.ZodType<T>, signal: AbortSignal, maxTokens: number) {
  const key = process.env.STORY_API_KEY;
  if (!key) return json({ error: "AI_NOT_CONFIGURED" }, 503);
  await reserveProductionBudget("story");
  const response = await fetch(`${(process.env.STORY_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.STORY_MODEL || "gpt-4o", messages, response_format: { type: "json_object" }, max_tokens: maxTokens }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok) return json({ error: "AI_PROVIDER_ERROR" }, 502);
  const data = await response.json();
  let reply: unknown;
  try { reply = JSON.parse(data.choices?.[0]?.message?.content || ""); } catch { return json({ error: "AI_INVALID_REPLY" }, 502); }
  const parsed = schema.safeParse(reply);
  return parsed.success ? json(parsed.data) : json({ error: "AI_INVALID_REPLY" }, 502);
}
