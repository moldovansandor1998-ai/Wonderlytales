import { reserveProductionBudget } from './budget';
import { fetchWithTimeout } from './providers/translation';
export function assessHungarianTranscript(expected: string, transcript: string, language: string) {
  const normalize = (s: string) => s.toLocaleLowerCase('hu').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return { transcript, language, textMatches: normalize(expected) === normalize(transcript), hungarian: ['hu', 'hun'].includes(language) };
}
/** Short recorded dialogue only. The existing short ElevenLabs reservation is a
 * conservative ceiling for this bounded request; it is not a TTS quality approval. */
export async function reviewHungarianSpeech(audio: Buffer, expected: string, apiKey: string, endpoint = 'https://api.elevenlabs.io/v1/speech-to-text') {
  if (!apiKey || audio.length < 100 || audio.length > 256000 || !expected.trim() || expected.length > 250) throw new Error('Rövid magyar felvétel szükséges.');
  const form = new FormData();
  form.append('model_id', 'scribe_v2');
  form.append('tag_audio_events', 'false');
  form.append('timestamps_granularity', 'character');
  form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), 'dialogue.mp3');
  // No language hint and no expected text: recognize the actual recording independently.
  await reserveProductionBudget('tts_dialogue');
  const response = await fetchWithTimeout(endpoint, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form }, 45000);
  if (!response.ok) throw new Error('A hangellenőrzés nem sikerült: HTTP ' + response.status);
  const result = await response.json();
  if (typeof result.text !== 'string' || typeof result.language_code !== 'string') throw new Error('Hiányos hangellenőrzési válasz.');
  const words = Array.isArray(result.words) ? result.words : [];
  return { ...assessHungarianTranscript(expected, result.text, result.language_code), words };
}
