import { createHash } from 'crypto';
import type { StorageProvider } from './providers/storage';
import { assessHungarianTranscript, reviewHungarianSpeech } from './speechReview';

// Keep the provider revision: validating an existing recording must not buy it again.
const revision = 'scribe_v2_character_v1';
const letters = (text: string) => text.normalize('NFC').toLocaleLowerCase('hu').replace(/[^\p{L}\p{N}]/gu, '');
type Timing = { text: string; start: number; end: number; type?: string; characters?: Timing[] };
const multigraphs = ['dzs','dz','cs','gy','ly','ny','sz','ty','zs'];
const spellings = [...multigraphs.map(p => p[0]+p), ...multigraphs,
  ...[...'bcdfghjklmnprstvwxyz'].map(p => p+p)].sort((a,b)=>b.length-a.length);
/** A multigraph is one sound: zero-length component letters are acceptable only
 * inside a measured, positive-duration group. Never invent missing timestamps. */
export function validHungarianGraphemes(chars: Timing[]): boolean {
  const spoken=chars.filter(c=>letters(c.text));
  for(let i=0;i<spoken.length;) {
    const spelling=spellings.find(s=>spoken.slice(i,i+s.length).map(c=>c.text.toLocaleLowerCase('hu')).join('')===s
      && spoken.slice(i,i+s.length-1).every((c,j)=>spoken[i+j+1].start-c.end<.08));
    const n=spelling?.length??1;
    if(spoken[i+n-1].end<=spoken[i].start) return false;
    i+=n;
  }
  return spoken.length>0;
}
export function recordingTimingKey(audio: Buffer, expected: string) {
  return `audio/alignment/hu/${createHash('sha256').update(audio).update('\0').update(expected).update('\0' + revision).digest('hex')}.json`;
}
export function validWordTimings(words: unknown): words is Timing[] {
  if (!Array.isArray(words) || !words.length || words.length > 2000) return false;
  let lastEnd = 0;
  for (const word of words) {
    if (!word || typeof word.text !== 'string' || typeof word.start !== 'number' || typeof word.end !== 'number'
      || !Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end < word.start
      || word.start < lastEnd - 1e-6 || word.end > 60) return false;
    lastEnd = word.end;
  }
  return true;
}
/** Orthographic alignment only; a word-level transcript alone cannot drive a mouth. */
export function validCharacterTimings(words: unknown, expected: string): boolean {
  if (!validWordTimings(words)) return false;
  const spoken = words.filter(w => w.type === 'word');
  if (!spoken.length || letters(spoken.map(w => w.text).join('')) !== letters(expected)) return false;
  for (const word of spoken) {
    const chars = word.characters;
    if (!validWordTimings(chars) || letters(chars.map(c => c.text).join('')) !== letters(word.text)) return false;
    if (chars.some(c => c.start < word.start - .001 || c.end > word.end + .001
      || [...c.text.normalize('NFC')].length !== 1) || !validHungarianGraphemes(chars)) return false;
  }
  return true;
}
export function validateRecordedReview(cached: any, audio: Buffer, expected: string) {
  if (!cached || cached.revision !== revision || cached.audio_sha256 !== createHash('sha256').update(audio).digest('hex')
    || cached.expected_text !== expected || typeof cached.transcript !== 'string' || typeof cached.language !== 'string'
    || !Array.isArray(cached.words)) throw new Error('A felvétel időzítési mentése sérült.');
  const assessment = assessHungarianTranscript(expected, cached.transcript, cached.language);
  const wordValid = validWordTimings(cached.words);
  const characterValid = validCharacterTimings(cached.words, expected);
  return { ...cached, ...assessment, validation_revision: 3,
    word_timings_valid: wordValid, character_timings_valid: characterValid,
    usable_for_lipsync: assessment.hungarian && assessment.textMatches && characterValid,
    phoneme_alignment_verified: false, facial_animation_approved: false };
}
export async function readRecordedSpeech(storage: StorageProvider, audio: Buffer, expected: string) {
  const key = recordingTimingKey(audio, expected);
  if (!(await storage.exists(key))) return null;
  return validateRecordedReview(JSON.parse((await storage.get(key)).toString('utf8')), audio, expected);
}
/** Timings belong to these exact audio bytes and script. Never trust cached approval flags. */
export async function reviewRecordedSpeech(storage: StorageProvider, audio: Buffer, expected: string, apiKey: string,
  recognize: typeof reviewHungarianSpeech = reviewHungarianSpeech) {
  const cached = await readRecordedSpeech(storage, audio, expected);
  if (cached) return cached;
  const result = await recognize(audio, expected, apiKey);
  const saved = validateRecordedReview({ ...result, revision,
    audio_sha256: createHash('sha256').update(audio).digest('hex'), expected_text: expected }, audio, expected);
  await storage.put(recordingTimingKey(audio, expected), JSON.stringify(saved), 'application/json');
  return saved;
}
