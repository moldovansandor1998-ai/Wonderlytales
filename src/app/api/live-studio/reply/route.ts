import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { reserveProductionBudget } from "@/lib/budget";
import { replyInput, replyMessages, replySchema } from "@/lib/live/events";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const input = replyInput.parse(await readJson(request));
    const key = process.env.STORY_API_KEY;
    if (!key) return json({ error: "AI_NOT_CONFIGURED" }, 503);
    await reserveProductionBudget("story");
    const response = await fetch(`${(process.env.STORY_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.STORY_MODEL || "gpt-4o", messages: replyMessages(input), response_format: { type: "json_object" }, max_tokens: 220 }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) return json({ error: "AI_PROVIDER_ERROR" }, 502);
    const data = await response.json();
    let reply: unknown;
    try { reply = JSON.parse(data.choices?.[0]?.message?.content || ""); } catch { return json({ error: "AI_INVALID_REPLY" }, 502); }
    const parsed = replySchema.safeParse(reply);
    if (!parsed.success) return json({ error: "AI_INVALID_REPLY" }, 502);
    return json(parsed.data);
  } catch (error) { return apiError(error); }
}
