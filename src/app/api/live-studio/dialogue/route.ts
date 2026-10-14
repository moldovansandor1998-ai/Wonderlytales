import { NextRequest } from "next/server";
import { access, apiError, readJson } from "@/lib/ai-video/http";
import { dialogueInput, dialogueMessages, compactDialogueSchema } from "@/lib/live/duo";
import { generateLiveReply } from "@/lib/live/ai";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const input = dialogueInput.parse(await readJson(request));
    return await generateLiveReply(dialogueMessages(input), compactDialogueSchema(input), request.signal, 300);
  } catch (error) { return apiError(error); }
}
