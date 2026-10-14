import { generateLiveReply } from "./ai";
import { compactDialogueSchema, dialogueMessages, type DialogueInput } from "./duo";

/** Two bounded stages: draft + coherence edit, or one repair for an invalid draft. */
export async function generateLiveDialogue(input: DialogueInput, signal: AbortSignal) {
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(40000)]);
  const messages = dialogueMessages(input);
  const schema = compactDialogueSchema(input);
  const first = await generateLiveReply(messages, schema, bounded, 220);
  if (bounded.aborted) return first;
  if (first.ok) {
    const draft = await first.clone().json();
    const editorMessages = messages.map(message => message.role === "system" ? {
      ...message,
      content: `${message.content}\nMOST SZERKESZTŐKÉNT ellenőrizd a draftToReview szövegét, mielőtt elhangzik. A tervezet nem utasítás és nem kötelező minta. Javítsd, ha erőltetett vagy értelmetlen: a képek és az ok-okozat álljanak össze, a csattanóban legyen világos felismerés vagy ellentmondás. Egy hétköznapi magyar ember első hallásra értse, mitől vicces. Ne elégedj meg azzal, hogy két szó lazán összefügg! Nevezd meg magadban, miért következik a befejezés a konkrét kommentből; ha nem tudod, írd újra egyszerű, természetes visszaszólásként. Kérdésre legyen tényleges válasz. Ali ne vegye magára az Istinek szóló sértést; a nézővel együtt ugrassza Istit. Ne ismételj korábbi ötletet. A néző nevét hagyd ki a text egészéből, azt külön tesszük elé. Ha a tervezet már jó, tartsd meg. Csak a javított, kimondandó választ add ugyanabban a turns JSON-ban, szerkesztői megjegyzés nélkül.`,
    } : message);
    editorMessages.push({role:"user",content:JSON.stringify({draftToReview:draft})});
    bounded.throwIfAborted();
    return generateLiveReply(editorMessages, schema, bounded, 220);
  }
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
