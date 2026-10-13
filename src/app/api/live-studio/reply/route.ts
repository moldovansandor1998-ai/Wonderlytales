import { NextRequest } from "next/server";
import { access, apiError, readJson } from "@/lib/ai-video/http";
import { replyInput, replyMessages, replySchema } from "@/lib/live/events";
import { generateLiveReply } from "@/lib/live/ai";
export const runtime = "nodejs";
export const maxDuration = 45;
export async function POST(request: NextRequest) {
  try {
    await access(request, true);
    const input = replyInput.parse(await readJson(request));
    return await generateLiveReply(replyMessages(input), replySchema, request.signal, 220);
  } catch (error) { return apiError(error); }
}
