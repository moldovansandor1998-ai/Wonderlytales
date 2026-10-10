import type { Db } from './db';
import type { Character, DialogueLine, Episode, Scene, Voice } from './types';

/** Resolve ownership before reading bytes or spending on speech recognition. */
export async function dialogueRecording(db: Db, id: string) {
  const line = await db.get<DialogueLine>('dialogue_lines', id);
  if (!line || line.language !== 'hu') throw new Error('Magyar dialógus szükséges.');
  const scene = await db.get<Scene>('scenes', line.scene_id);
  const character = await db.get<Character>('characters', line.character_id);
  const episode = scene && await db.get<Episode>('episodes', scene.episode_id);
  if (!scene || !character || !episode || episode.master_language !== 'hu'
    || (('episode_id' in line) && line.episode_id !== scene.episode_id)) throw new Error('A dialógus jelenet- vagy karakterkapcsolata hibás.');
  const voices = await db.find<Voice>('voices', v => v.character_id === character.id && v.language === 'hu' && v.provider === 'elevenlabs');
  const selectedId = (character as Character & { voice_id?: string }).voice_id;
  const voice = selectedId ? voices.find(v => v.id === selectedId) : voices.length === 1 ? voices[0] : undefined;
  if (!voice || !/^[A-Za-z0-9]+$/.test(voice.voice_id)) throw new Error('Hiányzó vagy többértelmű magyar karakterhang.');
  const match = /^audio\/tts\/hu\/([A-Za-z0-9]+)\/([a-f0-9]{24})\.mp3$/.exec(line.audio_path ?? '');
  if (!match || match[1] !== voice.voice_id) throw new Error('A felvétel nem a dialógus karakterhangjához tartozik.');
  return { line, scene, character, episode, voice, path: line.audio_path! };
}
