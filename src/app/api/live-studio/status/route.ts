import { NextRequest } from "next/server";
import { access, apiError, json } from "@/lib/ai-video/http";
import { liveAiProvider } from "@/lib/live/ai";
import { avatarConfiguration } from "@/lib/live/avatar";
export async function GET(request: NextRequest) {
  try { await access(request); return json({ ai: !!liveAiProvider(), aiProvider: liveAiProvider(), voice: !!process.env.ELEVENLABS_API_KEY, avatar: avatarConfiguration() }); }
  catch (error) { return apiError(error); }
}
