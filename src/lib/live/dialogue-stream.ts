import { generateLiveReply, LIVE_FAST_INPUT_BYTES } from "./ai";
import { compactDialogueSchema, dialogueMessages, replySpeaker, type Dialogue, type DialogueInput, type DialogueTurn } from "./duo";

/** Same character/coherence rules; plain spoken text avoids waiting for a JSON envelope. */
export function streamingMessages(input: DialogueInput) {
  const recent = [...input.history];
  const make = () => dialogueMessages({...input,history:recent}).map(message => message.role === "system" ? {
    ...message,
    content: message.content.replace(/Csak JSON:.*$/su, "Kizárólag a kimondandó magyar válasz szövegét írd. Nincs JSON, szereplőnév, idézőjel, felsorolás vagy színpadi utasítás. A néző megszólítását a lejátszó teszi elé. Az első mondat önmagában is értelmes reakció legyen a konkrét kommentre; ne legyen üres időhúzó felvezetés."),
  } : message);
  let messages = make();
  while (recent.length && Buffer.byteLength(JSON.stringify(messages), "utf8") > LIVE_FAST_INPUT_BYTES) { recent.shift(); messages = make(); }
  return messages;
}

export async function generateStreamingDialogue(input: DialogueInput, signal: AbortSignal, onSentence: (turn: DialogueTurn, addition: string) => Promise<void>): Promise<Dialogue> {
  const schema = compactDialogueSchema(input), speaker = replySpeaker(input);
  const toReply = (text: string) => ({turns:[{speaker,text,emotion:"laugh" as const}]});
  let emitted = "";
  const emit = async (dialogue: Dialogue) => {
    const turn = dialogue.turns[0];
    if (!turn.text.startsWith(emitted)) throw new Error("AI_INVALID_REPLY");
    const addition = turn.text.slice(emitted.length).trim();
    if (addition) { await onSentence(turn, addition); emitted = turn.text; }
  };
  const onText = async (text: string) => {
    // Only complete, validated sentences can be spoken, never partial words or JSON.
    const ends = [...text.matchAll(/[.!?]+(?=\s)/gu)];
    if (!ends.length) return;
    const last = ends[ends.length - 1];
    const parsed = schema.safeParse(toReply(text.slice(0, last.index! + last[0].length)));
    if (parsed.success) await emit(parsed.data);
  };
  const messages = streamingMessages(input);
  let response = await generateLiveReply(messages, schema, signal, 220, {onText,toReply});
  if (!response.ok) {
    const failure = await response.json();
    // Once speech has started, never replace it, repeat it, or pay for a repair.
    if (emitted || failure.error !== "AI_INVALID_REPLY" || signal.aborted) throw new Error(failure.error || "AI_PROVIDER_ERROR");
    response = await generateLiveReply(messages, schema, signal, 220, {onText,toReply});
    if (!response.ok) throw new Error((await response.json()).error || "AI_PROVIDER_ERROR");
  }
  const dialogue = await response.json() as Dialogue;
  await emit(dialogue);
  return dialogue;
}
