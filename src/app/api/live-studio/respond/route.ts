import { NextRequest } from "next/server";
import { z } from "zod";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { dialogueInput, dialogueSchema } from "@/lib/live/duo";
import { generateLiveDialogue } from "@/lib/live/dialogue";
import { streamSpeech } from "@/lib/live/speech";
import { streamedResponse } from "@/lib/live/respond-stream";
export const runtime = "nodejs";
export const maxDuration = 60;
const voice = z.string().regex(/^[a-zA-Z0-9]{1,100}$/);
const inputSchema = dialogueInput.extend({voices:z.object({ali:voice,isti:voice})});
/** One authenticated request from incoming comment through first audio bytes. */
export async function POST(request: NextRequest) {
  try {
    await access(request,true);
    const input = inputSchema.parse(await readJson(request));
    if(request.headers.get("accept")?.includes("application/x-ndjson"))return streamedResponse(input,request.signal,request.headers.get("X-Live-Audio-Format")==="pcm"?"pcm":"mp3");
    const generated = await generateLiveDialogue(input, request.signal);
    if (!generated.ok) return generated;
    const dialogue = dialogueSchema.parse(await generated.json());
    request.signal.throwIfAborted();
    const turn = dialogue.turns[0];
    const audio = await streamSpeech({text:turn.text,voiceId:input.voices[turn.speaker]},request.signal);
    audio.headers.set("X-Live-Dialogue",encodeURIComponent(JSON.stringify(dialogue)));
    return audio;
  } catch(error) {
    if(error instanceof Error&&["ELEVENLABS_NOT_CONFIGURED","VOICE_RATE_LIMIT","VOICE_PROVIDER_ERROR"].includes(error.message))return json({error:error.message},503);
    return apiError(error);
  }
}
