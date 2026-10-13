import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { speechInput, timedSpeech } from "@/lib/live/speech";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const input = speechInput.parse(await readJson(request));
    return json(await timedSpeech(input, request.signal));
  } catch (error) {
    if (error instanceof Error && ["ELEVENLABS_NOT_CONFIGURED", "VOICE_RATE_LIMIT", "VOICE_PROVIDER_ERROR"].includes(error.message)) return json({ error: error.message }, 503);
    return apiError(error);
  }
}
