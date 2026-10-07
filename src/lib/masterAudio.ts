import type { Db } from './db';
import { newId, now } from './db';
import type { DialogueLine, Scene, Voice, Episode, CostEvent } from './types';
import { getTtsProvider, ttsCacheKey, resolveTtsModel, type TtsProvider } from './providers/tts';
import { getStorage, type StorageProvider } from './providers/storage';
import { getPricing } from './pricing';

export async function masterAudioBatch(db: Db, episodeId: string, batchSize = 3,
  dependencies?: { tts: TtsProvider; storage: StorageProvider }) {
  const ep = await db.get<Episode>('episodes', episodeId);
  if (!ep || ep.master_language !== 'hu') throw new Error('Magyar master epizód szükséges.');
  const scenes = await db.find<Scene>('scenes', s => s.episode_id === episodeId);
  const order = new Map(scenes.map(s => [s.id, s.number]));
  const lines = (await db.find<DialogueLine>('dialogue_lines', l => order.has(l.scene_id) && l.language === 'hu'))
    .sort((a,b) => order.get(a.scene_id)! - order.get(b.scene_id)! || a.sequence - b.sequence);
  if (!lines.length) throw new Error('Nincs felmondható magyar dialógus.');
  const voices = await db.list<Voice>('voices');
  // Validate the entire episode before the first paid request; never silently substitute voices.
  const planned = lines.map(line => {
    const voice = voices.find(v => v.character_id === line.character_id && v.language === 'hu' && v.provider === 'elevenlabs');
    if (!voice?.voice_id) throw new Error('Hiányzó magyar ElevenLabs karakterhang.');
    if (!line.text.trim() || line.text.length > 250) throw new Error('A dialógus legfeljebb 250 karakter lehet; bontsd megszólalásokra.');
    const config = { language: 'hu', voiceId: voice.voice_id, model: resolveTtsModel({ language: 'hu', voiceId: voice.voice_id, model: voice.model }), stability: voice.stability, style: voice.style, budgetService: 'tts_dialogue' as const };
    const path = `audio/tts/hu/${voice.voice_id}/${ttsCacheKey(line.text, config)}.mp3`;
    return { line, config, path };
  });
  const storage = dependencies?.storage ?? getStorage();
  const tts = dependencies?.tts ?? getTtsProvider();
  let processed = 0;
  for (const item of planned) {
    if (item.line.audio_path === item.path && await storage.exists(item.path)) continue;
    if (processed >= Math.max(1, Math.min(3, batchSize))) break;
    // Recover an upload that completed before a database write failed, without another paid call.
    if (!(await storage.exists(item.path))) {
      const audio = await tts.synthesize(item.line.text, item.config);
      if (!audio.audio || audio.path !== item.path) throw new Error('A szolgáltató nem adott valódi master hangot.');
      await storage.put(item.path, audio.audio, 'audio/mpeg', { dialogue: item.line.id, episode: episodeId, script: ep.script_version });
      await db.insert<CostEvent>('cost_events', { id: newId(), episode_id: episodeId, project_id: null, series_id: null, shot_id: item.line.shot_id,
        category: 'TTS', provider: tts.name, service: 'tts_dialogue_estimate', language: 'hu', amount_usd: audio.costUsd,
        quantity: item.line.text.length, unit: 'char', unit_price_usd: getPricing().ttsPerChar, currency: 'USD', created_at: now() });
    }
    await db.update<DialogueLine>('dialogue_lines', item.line.id, { audio_path: item.path });
    item.line.audio_path = item.path;
    processed++;
  }
  // Completed means recorded dialogue only, never a finished film or approved performance.
  const completed = planned.filter(i => i.line.audio_path === i.path).length;
  return { completed, total: planned.length, done: completed === planned.length };
}
