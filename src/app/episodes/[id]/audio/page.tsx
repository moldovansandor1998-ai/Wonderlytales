import { ttsCacheKey } from '@/lib/providers/tts';
import { getDb } from '@/lib/db';
import { requireStudioUser } from '@/lib/auth';
import type { Episode, DialogueLine, Scene, Character, Voice } from '@/lib/types';
import { MasterAudioButton } from '@/components/masterAudioButton';
import { masterAudioBatchAction } from '@/lib/actions';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export default async function MasterAudioPage({ params }: { params: { id: string } }) {
  await requireStudioUser();
  const db = await getDb();
  const ep = await db.get<Episode>('episodes', params.id);
  if (!ep) notFound();
  const scenes = (await db.find<Scene>('scenes', s => s.episode_id === ep.id)).sort((a,b)=>a.number-b.number);
  const ids = new Set(scenes.map(s=>s.id));
  const lines = await db.find<DialogueLine>('dialogue_lines', l=>ids.has(l.scene_id) && l.language==='hu');
  const chars = await db.list<Character>('characters');
  const voices = await db.list<Voice>('voices');
  const currentAudio = (line: DialogueLine) => {
    const voice = voices.find(v => v.character_id === line.character_id && v.language === 'hu' && v.provider === 'elevenlabs');
    if (!voice) return false;
    const key = ttsCacheKey(line.text, { language: 'hu', voiceId: voice.voice_id, model: voice.model, stability: voice.stability, style: voice.style });
    return line.audio_path === `audio/tts/hu/${voice.voice_id}/${key}.mp3`;
  };
  return <><h1 className="text-2xl font-semibold mb-3">{ep.title} – magyar szinkron</h1>
    <p className="mb-4">{ep.script_version} · {lines.filter(currentAudio).length}/{lines.length} rögzített megszólalás. A hangfelvételek rendezői ellenőrzésre várnak; a film még gyártás alatt áll.</p>
    <MasterAudioButton action={masterAudioBatchAction.bind(null,ep.id)} />
    {lines.length > 0 && lines.every(currentAudio) && <a href={`/api/episodes/${ep.id}/audio-package`} className="text-amber-400 block my-4">Összes magyar hangfelvétel letöltése ZIP-ben</a>}
    {scenes.map(s=><section key={s.id} className="my-6"><h2 className="font-semibold">{s.number}. {s.title}</h2>
      {lines.filter(l=>l.scene_id===s.id).sort((a,b)=>a.sequence-b.sequence).map(l=><div key={l.id} className="my-3">
        <p>{chars.find(c=>c.id===l.character_id)?.name}: {l.text}</p>
        {currentAudio(l) && <audio controls preload="none" src={`/api/dialogue/${l.id}/audio`} />}
        {l.audio_path && !currentAudio(l) && <p className="text-amber-400">Korábbi hang: új magyar felvétel szükséges.</p>}
      </div>)}</section>)}
  </>;
}
