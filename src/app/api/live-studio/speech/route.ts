import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { ElevenLabsTts } from "@/lib/providers/tts";

export const runtime = "nodejs";
export const maxDuration = 60;
const input = z.object({ text: z.string().trim().min(1).max(1000), voiceId: z.string().regex(/^[a-zA-Z0-9]{1,100}$/) });

export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const parsed = input.parse(await readJson(request));
    if (!process.env.ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_NOT_CONFIGURED" }, 503);
    const result = await new ElevenLabsTts(process.env.ELEVENLABS_API_KEY).synthesize(parsed.text, {
      language: "hu", voiceId: parsed.voiceId, model: "eleven_flash_v2_5", stability: 0.5,
    });
    if (!result.audio) return json({ error: "AUDIO_UNAVAILABLE" }, 502);
    return new NextResponse(new Uint8Array(result.audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
