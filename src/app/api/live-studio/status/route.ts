import { NextRequest } from "next/server";
import { access, apiError, json } from "@/lib/ai-video/http";
import { avatarConfiguration } from "@/lib/live/avatar";
import { liveAIConfiguration } from "@/lib/live/ai";
export async function GET(request: NextRequest) {
  try { await access(request); const ai = liveAIConfiguration(); return json({ ai: ai.configured, aiModel: ai.model, voice: !!process.env.ELEVENLABS_API_KEY, avatar: avatarConfiguration() }); }
  catch (error) { return apiError(error); }
}
