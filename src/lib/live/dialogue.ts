import { generateLiveReply } from "./ai";
import { compactDialogueSchema, dialogueMessages, type DialogueInput } from "./duo";

/** One internally reviewed reply; only invalid output gets one bounded repair. */
export async function generateLiveDialogue(input: DialogueInput, signal: AbortSignal) {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(40000)]);
  const messages = dialogueMessages(input);
  const schema = compactDialogueSchema(input);
  const first = await generateLiveReply(messages, schema, bounded, 220);
  if (bounded.aborted) return first;
  if (first.ok) return first;
  const failure = await first.clone().json().catch(() => null);
  // Credit, authentication, provider and rate-limit failures must never spend again.
  if (failure?.error !== "AI_INVALID_REPLY") return first;
  bounded.throwIfAborted();
  const retryMessages = messages.map(message => message.role === "system" ? {
    ...message,
    content: `${message.content}\nAz előző generálás nem használható. Írj teljesen új, rövid választ a jelenlegi kommentre. Ne ismételj korábbi poént, ne csak egy szót mondj, ne térj el a témától vagy a kijelölt szereplőtől. Maximum két teljes mondat, érvényes JSON.`,
  } : message);
  return generateLiveReply(retryMessages, schema, bounded, 220);
}
