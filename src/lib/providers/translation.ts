/** TranslationProvider: mock + production LLM-alapú adapter */
export interface TranslationRequest { text: string; sourceLang: string; targetLang: string; characterName: string; emotion: string; timingSec: number; ageRange: string; }
export interface TranslationResult { text: string; provider: string; }
export interface TranslationProvider { name: string; translate(req: TranslationRequest): Promise<TranslationResult>; }

export class MockTranslationProvider implements TranslationProvider {
  name = "mock";
  async translate(req: TranslationRequest): Promise<TranslationResult> {
    return { text: `[${req.targetLang.toUpperCase()}] ${req.text}`, provider: this.name };
  }
}

/** Production: OpenAI-kompatibilis chat completions endpoint (provider-agnostic) */
export class ProductionTranslationProvider implements TranslationProvider {
  name = "llm";
  constructor(private apiKey: string, private baseUrl = process.env.TRANSLATION_BASE_URL ?? "https://api.openai.com/v1", private model = process.env.TRANSLATION_MODEL ?? "gpt-4o-mini") {}
  async translate(req: TranslationRequest): Promise<TranslationResult> {
    const prompt = `Fordítsd le a következő gyermekműsor-párbeszédet ${req.sourceLang} → ${req.targetLang} nyelvre. Szabályok: a karakter neve (${req.characterName}) maradjon változatlan; őrizd meg a jelentést, a gyerekbarát stílust (${req.ageRange} év) és az érzelmi töltetet (${req.emotion}); a mondat nagyjából ${req.timingSec} másodperc alatt kimondható legyen. Csak a fordítást add vissza, idézőjel nélkül.\n\nSzöveg: ${req.text}`;
    const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
    }, 30000);
    if (!res.ok) throw new Error(`Translation API hiba: ${res.status} ${await res.text().catch(() => "")}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Translation API: üres válasz");
    return { text, provider: this.name };
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

export function getTranslationProvider(): TranslationProvider {
  if ((process.env.TRANSLATION_PROVIDER === "llm" || process.env.STORY_API_KEY) && (process.env.TRANSLATION_API_KEY || process.env.STORY_API_KEY))
    return new ProductionTranslationProvider(process.env.TRANSLATION_API_KEY || process.env.STORY_API_KEY!);
  return new MockTranslationProvider();
}
