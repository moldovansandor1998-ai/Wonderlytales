import { NextRequest } from "next/server";
import { access, apiError, json } from "@/lib/ai-video/http";
import { accountVoices } from "@/lib/ai-video/voices";
export async function GET(request: NextRequest) {
  try { await access(request); return json({ voices: await accountVoices() }); }
  catch (error) { return apiError(error); }
}
