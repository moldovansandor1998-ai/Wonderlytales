import plan from './s1e1PerformancePlan.json';
import { getDb, newId, now } from './db';
import { getTtsProvider, ttsCacheKey } from './providers/tts';
import { getStorage } from './providers/storage';
import type { Character, Voice, Episode, DialogueLine, Scene, CostEvent } from './types';

export const performanceEpisode = '61e0de73-8206-4bf9-8ed7-f4132de7db50';
export async function performanceItems(episodeId: string) {
  if (episodeId !== performanceEpisode) throw new Error('Ehhez az epizódhoz még nincs hangrendezési terv.');
  const db = await getDb();
  const ep = await db.get<Episode>('episodes', episodeId);
  if (!ep || ep.master_language !== 'hu') throw new Error('Magyar epizód szükséges.');
  const [chars, voices, scenes, lines] = await Promise.all([db.list<Character>('characters'), db.list<Voice>('voices'), db.list<Scene>('scenes'), db.list<DialogueLine>('dialogue_lines')]);
  const sceneIds = new Set(scenes.filter(s => s.episode_id === episodeId).map(s => s.id));
  return plan.map(item => {
    const char = chars.find(c => c.code === item.character);
    const voice = voices.find(v => v.character_id === char?.id && v.language === 'hu' && v.provider === 'elevenlabs');
    if (!char || !voice) throw new Error('Hiányzó karakterhang.');
    if (item.kind === 'DIALOGUE' && !lines.some(l => l.id === item.id && sceneIds.has(l.scene_id) && l.character_id === char.id && l.language === 'hu' && l.text === item.text)) throw new Error('A forgatókönyv megváltozott: a hangrendezési tervet frissíteni kell.');
    if (item.performance_text.length > 250) throw new Error('Túl hosszú megszólalás.');
    const config = { language: 'hu', voiceId: voice.voice_id, model: 'eleven_v3', stability: 0.5, style: 0, budgetService: 'tts_dialogue' as const };
    return { ...item, config, path: `audio/tts/hu/${voice.voice_id}/${ttsCacheKey(item.performance_text, config)}.mp3` };
  });
}
export async function performanceBatch(episodeId: string) {
  const items = await performanceItems(episodeId), storage = getStorage(), db = await getDb();
  const ready = await Promise.all(items.map(item => storage.exists(item.path)));
  let completed = ready.filter(Boolean).length, generated = 0;
  for (const [index, item] of items.entries()) {
    if (ready[index]) continue;
    if (generated >= 2) continue;
    const result = await getTtsProvider().synthesize(item.performance_text, item.config);
    if (!result.audio || result.provider !== 'elevenlabs' || result.path !== item.path) throw new Error('Valódi karakterhang szükséges.');
    await storage.put(item.path, result.audio, 'audio/mpeg', { episode: episodeId, performance: item.id, revision: 'V016' });
    await db.insert<CostEvent>('cost_events', { id: newId(), episode_id: episodeId, project_id: null, series_id: null, shot_id: null, category: 'TTS', provider: result.provider, service: 'expressive_v3_estimate', amount_usd: result.costUsd, quantity: item.performance_text.length, unit: 'char', currency: 'USD', created_at: now() });
    generated++; completed++;
  }
  return { completed, total: items.length, done: completed === items.length };
}
