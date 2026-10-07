import { requireConfiguration, rejectProductionMock } from "../config";
import { z } from "zod";
import { fetchWithTimeout } from "./translation";

/** StoryEngine: provider-agnostic interface + MOCK + production LLM adapter */
export interface StoryInput { bible: string; seasonContext: string; previousSummaries: string[]; brief: string; ageRange: string; durationSec: number; language: string; }

export const StoryOutputSchema = z.object({
  title: z.string().min(1),
  synopsis: z.string().min(1),
  acts: z.array(z.object({ title: z.string(), summary: z.string() })).min(1),
  scenes: z.array(z.object({
    title: z.string(), location_hint: z.string(),
    beats: z.array(z.string()), characters: z.array(z.string()),
  })).min(1),
  continuity_notes: z.array(z.string()),
  season_arc_contribution: z.string(),
});
export type StoryOutput = z.infer<typeof StoryOutputSchema>;

export interface StoryEngine { name: string; generateEpisode(input: StoryInput): Promise<StoryOutput>; }

export class MockStoryEngine implements StoryEngine {
  name = "mock";
  async generateEpisode(i: StoryInput): Promise<StoryOutput> {
    return StoryOutputSchema.parse({
      title: `Epizód – ${i.brief.slice(0, 40) || "Kaland a Csodakapunál"}`,
      synopsis: `A Csodakapu világában ${i.brief} (${i.ageRange}, ${Math.round(i.durationSec / 60)} perc).`,
      acts: [
        { title: "1. felvonás – Felütés", summary: "A csapat felfedezi az epizód világát." },
        { title: "2. felvonás – Próbatétel", summary: "Akadály és csapatmunka." },
        { title: "3. felvonás – Megoldás", summary: "A lecke és a hazatérés Makkfalvára." },
      ],
      scenes: [
        { title: "Erdő a kapunál", location_hint: "LOC_FOREST", beats: ["érkezés", "a kapu aktiválódik"], characters: ["Márk", "Lili", "Morzsi"] },
        { title: "A kapu másik oldala", location_hint: "LOC_GATE_WORLD", beats: ["csoda", "konfliktus"], characters: ["Márk", "Pötty", "Bogyó"] },
      ],
      continuity_notes: ["Márk nála van a csillagszilánk", "Az erdő DAY variánsból indulunk"],
      season_arc_contribution: "A Csodakapu rejtélye egy darabbal bővül.",
    });
  }
}

/** Production LLM adapter – OpenAI-kompatibilis endpoint, strukturált JSON output + Zod validáció + repair/retry */
export class LlmStoryEngine implements StoryEngine {
  name = "llm";
  constructor(private apiKey: string, private baseUrl = process.env.STORY_BASE_URL ?? "https://api.openai.com/v1", private model = process.env.STORY_MODEL ?? "gpt-4o") {}

  private prompt(i: StoryInput, repairNote?: string): string {
    return `Te a Wonderly Tales Studio StoryEngine-e vagy. Készíts epizódtervet a Series Bible alapján.
Series Bible: ${i.bible}
Season kontextus: ${i.seasonContext}
Korábbi epizódok: ${i.previousSummaries.join(" | ") || "–"}
Brief: ${i.brief}
Korosztály: ${i.ageRange}, hossz: ${Math.round(i.durationSec / 60)} perc, nyelv: ${i.language}
Válaszolj KIZÁRÓLAG JSON-nel, pontosan ezzel a sémával:
{"title": string, "synopsis": string, "acts": [{"title": string, "summary": string}], "scenes": [{"title": string, "location_hint": string, "beats": [string], "characters": [string]}], "continuity_notes": [string], "season_arc_contribution": string}
${repairNote ? `Előző válasz hibás volt: ${repairNote}. Javítsd és add vissza érvényes JSON-ként.` : ""}`;
  }

  private async call(i: StoryInput, repairNote?: string): Promise<string> {
    const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages: [{ role: "user", content: this.prompt(i, repairNote) }], temperature: 0.7, response_format: { type: "json_object" } }),
    }, 60000);
    if (!res.ok) throw new Error(`Story API hiba: ${res.status}`);
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }

  async generateEpisode(i: StoryInput): Promise<StoryOutput> {
    let lastErr = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await this.call(i, lastErr || undefined);
      try {
        const jsonText = raw.replace(/^```json\s*|```\s*$/g, "").trim();
        return StoryOutputSchema.parse(JSON.parse(jsonText));
      } catch (e) {
        lastErr = e instanceof Error ? e.message.slice(0, 300) : String(e);
      }
    }
    throw new Error(`StoryEngine: 3 próbálkozás után sem érvényes a kimenet. Utolsó hiba: ${lastErr}`);
  }
}

export function getStoryEngine(): StoryEngine {
  if (process.env.STORY_PROVIDER === "llm") {
    requireConfiguration("Story", ["STORY_API_KEY"]);
    return new LlmStoryEngine(process.env.STORY_API_KEY!);
  }
  rejectProductionMock("Story");
  return new MockStoryEngine();
}
