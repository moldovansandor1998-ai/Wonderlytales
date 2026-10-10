import type { Db } from './db';
import type { DialogueLine, Scene } from './types';
import { dialogueRecording } from './dialogueRecording';
import { reviewRecordedSpeech } from './speechTiming';
import type { StorageProvider } from './providers/storage';

/** Bounded resumable audit. Cache identity is audio bytes + canonical spoken script. */
export async function reviewEpisodeSpeech(db: Db, storage: StorageProvider, episodeId: string, cursor: number, apiKey: string,
  recognize?: Parameters<typeof reviewRecordedSpeech>[4]) {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Érvénytelen ellenőrzési pozíció.');
  const tables:Record<string,any[]>={};
  await Promise.all(['episodes','scenes','characters','voices','dialogue_lines'].map(async table=>{tables[table]=await db.list(table);}));
  const snapshot={get:async(t:string,id:string)=>tables[t].find(r=>r.id===id)??null,
    find:async(t:string,p:any)=>tables[t].filter(p)} as unknown as Db;
  const scenes=new Map((tables.scenes as Scene[]).filter(s=>s.episode_id===episodeId).map(s=>[s.id,s.number]));
  const lines=(tables.dialogue_lines as DialogueLine[]).filter(l=>scenes.has(l.scene_id)&&l.language==='hu')
    .sort((a,b)=>scenes.get(a.scene_id)!-scenes.get(b.scene_id)!||a.sequence-b.sequence||a.id.localeCompare(b.id));
  if (!lines.length || cursor>lines.length) throw new Error('Nincs ellenőrizhető magyar epizód.');
  // Resolve ALL ownership references before spending. No substitutions or voice generation.
  const recordings=await Promise.all(lines.map(l=>dialogueRecording(snapshot,l.id)));
  const end=Math.min(cursor+3,lines.length);const results=[];
  for(let index=cursor;index<end;index++) {
    const {line,path}=recordings[index];
    const result=await reviewRecordedSpeech(storage,await storage.get(path),line.text,apiKey,recognize);
    results.push({id:line.id,usable:result.usable_for_lipsync,language:result.language,textMatches:result.textMatches});
  }
  return {completed:end,total:lines.length,done:end===lines.length,results};
}
