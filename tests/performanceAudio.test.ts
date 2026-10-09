import { beforeEach, describe, expect, it, vi } from 'vitest';
import plan from '@/lib/s1e1PerformancePlan.json';
import { ttsCacheKey } from '@/lib/providers/tts';
const f = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, stored: new Map<string,Buffer>(), synthesize: vi.fn(), insert: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: async () => ({ get: async (t:string,id:string) => f.rows[t].find(x => x.id === id), list: async (t:string) => f.rows[t], insert: f.insert }), newId: () => 'cost', now: () => '2026-10-09' }));
vi.mock('@/lib/providers/storage', () => ({ getStorage: () => ({ exists: async (key:string) => f.stored.has(key), put: async (key:string,data:Buffer) => { f.stored.set(key,data); } }) }));
vi.mock('@/lib/providers/tts', async () => { const actual = await vi.importActual<any>('@/lib/providers/tts'); return { ...actual, getTtsProvider: () => ({ synthesize: f.synthesize }) }; });
import { performanceBatch, performanceEpisode, performanceItems } from '@/lib/performanceAudio';
beforeEach(() => {
  f.stored.clear(); f.synthesize.mockReset(); f.insert.mockReset();
  const codes = [...new Set(plan.map(i => i.character))];
  f.rows = { episodes: [{ id: performanceEpisode, master_language: 'hu' }], characters: codes.map(code => ({ id: code, code })), voices: codes.map(code => ({ character_id: code, language: 'hu', provider: 'elevenlabs', voice_id: code.replaceAll('_','') })), scenes: [{ id:'scene', episode_id:performanceEpisode }], dialogue_lines:plan.filter(i => i.kind==='DIALOGUE').map(i => ({ id:i.id, scene_id:'scene', character_id:i.character, language:'hu', text:i.text, audio_path:'old-recording.mp3' })) };
  f.synthesize.mockImplementation(async (text,config) => ({ audio:Buffer.alloc(128), provider:'elevenlabs', costUsd:.01, path:`audio/tts/hu/${config.voiceId}/${ttsCacheKey(text,config)}.mp3` }));
});
describe('Expressive episode recording safeguards', () => {
  it('rejects stale scripts before making any paid request', async () => { f.rows.dialogue_lines[30].text='Changed'; await expect(performanceBatch(performanceEpisode)).rejects.toThrow('forgatókönyv'); expect(f.synthesize).not.toHaveBeenCalled(); });
  it('keeps canonical subtitles and original recordings intact', async () => { const before=JSON.stringify(f.rows.dialogue_lines); await performanceBatch(performanceEpisode); expect(JSON.stringify(f.rows.dialogue_lines)).toBe(before); expect(f.synthesize.mock.calls[0][1].budgetService).toBe('tts_dialogue'); expect(f.synthesize.mock.calls[0][1].model).toBe('eleven_v3'); });
  it('resumes from stored audio without charging again for completed clips', async () => { const items=await performanceItems(performanceEpisode); for (const item of items) f.stored.set(item.path,Buffer.alloc(128)); expect((await performanceBatch(performanceEpisode)).done).toBe(true); expect(f.synthesize).not.toHaveBeenCalled(); });
  it('propagates budget rejection without marking a recording complete', async () => { f.synthesize.mockRejectedValue(new Error('budget exhausted')); await expect(performanceBatch(performanceEpisode)).rejects.toThrow('budget exhausted'); expect(f.stored.size).toBe(0); expect(f.insert).not.toHaveBeenCalled(); });
});
