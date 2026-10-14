import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { speechInput, streamSpeech } from "@/lib/live/speech";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    return await streamSpeech(speechInput.parse(await readJson(request)), request.signal);
  } catch (error) {
    if (error instanceof Error && ["ELEVENLABS_NOT_CONFIGURED", "VOICE_RATE_LIMIT", "VOICE_PROVIDER_ERROR"].includes(error.message)) return json({error:error.message},503);
    return apiError(error);
  }
}
