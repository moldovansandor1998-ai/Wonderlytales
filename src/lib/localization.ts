import type { Db } from "./db";
import { newId, now } from "./db";
import type { DialogueLine, LocalizedLine, EpisodeLocalization, LocStatus, Voice, Character, CostEvent } from "./types";
import { getTtsProvider } from "./providers/tts";
import { getTranslationProvider } from "./providers/translation";
import { getStorage } from "./providers/storage";
import { isProduction } from "./config";
import { getPricing } from "./pricing";

export const SUPPORTED_LANGUAGES = ["hu","en","de","es","fr"];
export const LOC_FLOW: LocStatus[] = ["TRANSLATION_PENDING","TRANSLATING","TEXT_READY","TTS_PENDING","TTS_READY","LIPSYNC_PENDING","READY","FAILED"];

/** HU master → fordítás (TranslationProvider) → cél nyelvi TTS → új facial/lip-sync track. A 3D animáció NEM renderelődik újra. */
export async function localizeEpisode(db: Db, episodeId: string, targetLang: string): Promise<EpisodeLocalization> {
  const scenes = await db.find<{ id: string; episode_id: string }>("scenes", (s) => s.episode_id === episodeId);
  const sceneIds = new Set(scenes.map((s) => s.id));
  const lines = await db.find<DialogueLine>("dialogue_lines", (l) => sceneIds.has(l.scene_id) && l.language === "hu");
  const translator = getTranslationProvider();
  const tts = getTtsProvider();
  const voices = await db.list<Voice>("voices");
  const chars = await db.list<Character>("characters");
  const pricing = getPricing();

  const setLocStatus = async (status: LocStatus) => {
    const locs = await db.find<EpisodeLocalization>("episode_localizations", (l) => l.episode_id === episodeId && l.language === targetLang);
    if (locs.length) await db.update<EpisodeLocalization>("episode_localizations", locs[0].id, { status });
  };

  try {
    await setLocStatus("TRANSLATING");
    for (const line of lines) {
      const character = chars.find((c) => c.id === line.character_id);
      const translated = (await translator.translate({
        text: line.text, sourceLang: "hu", targetLang,
        characterName: character?.name ?? "", emotion: line.emotion,
        timingSec: Math.max(1, line.text.length / 14), ageRange: "4-9",
      })).text;
      await db.insert<CostEvent>("cost_events", { id: newId(), project_id: null, series_id: null, episode_id: episodeId, shot_id: null, category: "TRANSLATION", provider: translator.name, service: "translation", language: targetLang, amount_usd: line.text.length * pricing.translationPerChar, quantity: line.text.length, unit: "char", unit_price_usd: pricing.translationPerChar, currency: "USD", created_at: now() });

      const voice = voices.find((v) => v.character_id === line.character_id && v.language === targetLang)
        ?? voices.find((v) => v.character_id === line.character_id);
      if (isProduction() && !voice) throw new Error(`Hiányzó hangazonosság: ${character?.name ?? line.character_id} / ${targetLang}`);
      const audio = await tts.synthesize(translated, { language: targetLang, voiceId: voice?.voice_id ?? `default-${targetLang}`, model: voice?.model, stability: voice?.stability, style: voice?.style });
      if (audio.audio) await getStorage().put(audio.path, audio.audio, "audio/mpeg");
      const lineStatus: LocStatus = audio.audio ? "TTS_READY" : "TEXT_READY";
      if (audio.costUsd > 0) await db.insert<CostEvent>("cost_events", { id: newId(), project_id: null, series_id: null, episode_id: episodeId, shot_id: null, category: "TTS", provider: tts.name, service: "tts", language: targetLang, amount_usd: audio.costUsd, quantity: translated.length, unit: "char", unit_price_usd: pricing.ttsPerChar, currency: "USD", created_at: now() });

      const existing = await db.find<LocalizedLine>("localized_dialogue_lines", (l) => l.dialogue_line_id === line.id && l.language === targetLang);
      if (existing.length) {
        await db.update<LocalizedLine>("localized_dialogue_lines", existing[0].id, { text: translated, audio_path: audio.audio ? audio.path : null, status: lineStatus });
      } else {
        await db.insert<LocalizedLine>("localized_dialogue_lines", { id: newId(), dialogue_line_id: line.id, language: targetLang, text: translated, audio_path: audio.audio ? audio.path : null, status: lineStatus });
      }
    }
    const locs = await db.find<EpisodeLocalization>("episode_localizations", (l) => l.episode_id === episodeId && l.language === targetLang);
    // Assembly and facial generation have not run yet; never invent a master path.
    const patch = { status: (tts.name === "mock" ? "TEXT_READY" : "TTS_READY") as LocStatus, audio_master_path: null, subtitle_path: null };
    if (locs.length) return db.update<EpisodeLocalization>("episode_localizations", locs[0].id, patch);
    return db.insert<EpisodeLocalization>("episode_localizations", { id: newId(), episode_id: episodeId, language: targetLang, ...patch });
  } catch (e) {
    await setLocStatus("FAILED");
    throw e;
  }
}

export function hashKey(s: string): string {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h).toString(16).padStart(8, "0");
}
