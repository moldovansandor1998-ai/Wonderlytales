import { NextRequest } from "next/server";
import { access, apiError, readJson } from "@/lib/ai-video/http";
import { dialogueInput } from "@/lib/live/duo";
import { generateLiveDialogue } from "@/lib/live/dialogue";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const input = dialogueInput.parse(await readJson(request));
    return await generateLiveDialogue(input, request.signal);
  } catch (error) { return apiError(error); }
}
