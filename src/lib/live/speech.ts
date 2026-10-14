import { z } from "zod";
import { reserveProductionBudget } from "@/lib/budget";

const alignmentSchema = z.object({
  characters: z.array(z.string()).max(10000),
  character_start_times_seconds: z.array(z.number().finite().nonnegative()).max(10000),
  character_end_times_seconds: z.array(z.number().finite().nonnegative()).max(10000),
}).refine(a => a.characters.length === a.character_start_times_seconds.length && a.characters.length === a.character_end_times_seconds.length);
export type Alignment = z.infer<typeof alignmentSchema>;
export const speechInput = z.object({ text: z.string().trim().min(1).max(1000), voiceId: z.string().regex(/^[a-zA-Z0-9]{1,100}$/) });

/** Pass the first MP3 bytes through immediately; one reservation and one provider call. */
export async function streamSpeech(input: z.infer<typeof speechInput>, signal: AbortSignal) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_NOT_CONFIGURED");
  signal.throwIfAborted();
  const startedAt = Date.now();
  await reserveProductionBudget("tts");
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/stream?output_format=mp3_44100_64`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: input.text, model_id: "eleven_flash_v2_5", language_code: "hu", voice_settings: { stability: 0.4, similarity_boost: 0.75, use_speaker_boost: false } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  if (!response.ok || !response.body) throw new Error(response.status === 429 ? "VOICE_RATE_LIMIT" : "VOICE_PROVIDER_ERROR");
  console.info("live_speech_stream", { firstByteMs: Date.now() - startedAt, characters: input.text.length });
  return new Response(response.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/** One bounded paid attempt per utterance; no implicit retry after an ambiguous failure. */
export async function timedSpeech(input: z.infer<typeof speechInput>, signal?: AbortSignal) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_NOT_CONFIGURED");
  await reserveProductionBudget("tts");
  const timeout = AbortSignal.timeout(45000);
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ text: input.text, model_id: "eleven_flash_v2_5", language_code: "hu", voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true } }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error(response.status === 429 ? "VOICE_RATE_LIMIT" : "VOICE_PROVIDER_ERROR");
  const data = await response.json();
  if (typeof data.audio_base64 !== "string" || data.audio_base64.length < 100 || data.audio_base64.length > 8000000 || !/^[A-Za-z0-9+/=]+$/.test(data.audio_base64)) throw new Error("VOICE_PROVIDER_ERROR");
  const parsed = alignmentSchema.safeParse(data.normalized_alignment || data.alignment);
  return { audio: data.audio_base64 as string, alignment: parsed.success ? parsed.data : null };
}
