import { createHash } from 'crypto';
import type { StorageProvider } from './providers/storage';
import { reviewHungarianSpeech } from './speechReview';

const revision = 'scribe_v2_character_v1';
export function recordingTimingKey(audio: Buffer, expected: string) {
  const digest = createHash('sha256').update(audio).update('\0').update(expected).update('\0' + revision).digest('hex');
  return `audio/alignment/hu/${digest}.json`;
}
export function validWordTimings(words: unknown): boolean {
  if (!Array.isArray(words) || !words.length || words.length > 2000) return false;
  let last = -1;
  for (const word of words) {
    if (!word || typeof word.text !== 'string' || typeof word.start !== 'number' || typeof word.end !== 'number'
      || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start
      || word.start < last || word.end > 60) return false;
    last = word.start;
  }
  return true;
}
/** Timings belong to these exact audio bytes and script. A transcription match
 * does not establish phoneme alignment or facial-animation quality. */
export async function reviewRecordedSpeech(storage: StorageProvider, audio: Buffer, expected: string, apiKey: string,
  recognize: typeof reviewHungarianSpeech = reviewHungarianSpeech) {
  const key = recordingTimingKey(audio, expected);
  if (await storage.exists(key)) {
    const cached = JSON.parse((await storage.get(key)).toString('utf8'));
    if (cached.revision === revision && cached.audio_sha256 === createHash('sha256').update(audio).digest('hex')
      && cached.expected_text === expected && typeof cached.transcript === 'string' && Array.isArray(cached.words)) return cached;
    throw new Error('A felvétel időzítési mentése sérült.');
  }
  // The provider implementation reserves the bounded paid request atomically.
  const result = await recognize(audio, expected, apiKey);
  const saved = { ...result, revision, audio_sha256: createHash('sha256').update(audio).digest('hex'),
    expected_text: expected, word_timings_valid: validWordTimings(result.words),
    phoneme_alignment_verified: false, facial_animation_approved: false };
  await storage.put(key, JSON.stringify(saved), 'application/json');
  return saved;
}
