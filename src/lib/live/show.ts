import { dialogueSchema, type CastVoices, type Dialogue, type DialogueTurn } from "./duo";
export type PreparedClip = { url: string; requestId: string };
/** Prepare both fresh responses together, then air them once in dialogue order.
 * Parent stop or one failed generation cancels the other job; never retry paid work. */
export async function airDialogue(
  dialogue: Dialogue, voices: CastVoices, signal: AbortSignal,
  prepare: (turn: DialogueTurn, voiceId: string, signal: AbortSignal) => Promise<PreparedClip>,
  play: (clip: PreparedClip, turn: DialogueTurn, signal: AbortSignal) => Promise<void>,
) {
  const turns = dialogueSchema.parse(dialogue).turns;
  signal.throwIfAborted();
  if (turns.some(turn => !/^[a-zA-Z0-9]{1,100}$/.test(voices[turn.speaker]))) throw new Error("Mindkét szereplő ElevenLabs-hangját válaszd ki.");
  const batch = new AbortController();
  const stop = () => batch.abort();
  signal.addEventListener("abort", stop, { once: true });
  try {
    const clips = await Promise.all(turns.map(turn => prepare(turn, voices[turn.speaker], batch.signal)));
    for (let i = 0; i < turns.length; i++) { batch.signal.throwIfAborted(); await play(clips[i], turns[i], batch.signal); }
  } finally { batch.abort(); signal.removeEventListener("abort", stop); }
}
