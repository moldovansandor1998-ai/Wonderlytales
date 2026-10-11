import { randomUUID } from 'crypto';
import { createServerSupabase } from '../auth';
import { fetchWithTimeout } from '../providers/translation';
import { WaveSpeedError } from '../providers/wavespeed';

const SERIES = 'a2746bb2-96da-50d2-a433-c0a61207b2da';
const PROJECT = 'a2b6d64a-08a0-474f-b7c0-fa71121b00ab';
export type CastCharacter = { id:string; name:string; code:string; voice_id:string|null };
export type CastVoice = { id:string; character_id:string; language:string; provider:string; voice_id:string|null; provider_voice_id:string|null; model:string|null; status:string };
export type AccountVoice = { id:string; name:string; category:string };
export function characterVoice(character:CastCharacter, voices:CastVoice[]) {
  const own=voices.filter(v=>v.character_id===character.id && v.language==='hu' && v.provider==='elevenlabs' && !['TEMPORARY_WORK_TRACK','RETIRED'].includes(v.status));
  const voice=character.voice_id ? own.find(v=>v.id===character.voice_id) : own.length===1 ? own[0] : undefined;
  if(!voice) return null;
  const id=voice.provider_voice_id || voice.voice_id;
  if(!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id) || (voice.provider_voice_id && voice.voice_id && voice.provider_voice_id!==voice.voice_id)) return null;
  return {...voice,voice_id:id};
}
export async function readCast() {
  const db=createServerSupabase();
  const project=await db.from('series').select('id').eq('id',SERIES).eq('project_id',PROJECT).single();
  if(project.error) throw new WaveSpeedError('FORBIDDEN',403);
  const chars=await db.from('characters').select('id,name,code,voice_id').eq('series_id',SERIES).order('name');
  if(chars.error) throw new WaveSpeedError('VOICE_DATABASE_UNAVAILABLE');
  const characters=(chars.data??[]) as CastCharacter[];
  if(!characters.length)return {characters,voices:[] as CastVoice[]};
  const rows=await db.from('voices').select('id,character_id,language,provider,voice_id,provider_voice_id,model,status').in('character_id',characters.map(c=>c.id)).eq('language','hu').eq('provider','elevenlabs');
  if(rows.error)throw new WaveSpeedError('VOICE_DATABASE_UNAVAILABLE');
  return {characters,voices:(rows.data??[]) as CastVoice[]};
}
export async function accountVoices():Promise<AccountVoice[]> {
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key)throw new WaveSpeedError('ELEVENLABS_NOT_CONFIGURED',503);
  let token:string|undefined;const voices:AccountVoice[]=[];
  for(let page=0;page<10;page++) {
    const url=new URL('https://api.elevenlabs.io/v2/voices');url.searchParams.set('page_size','100');url.searchParams.set('include_total_count','false');
    if(token)url.searchParams.set('next_page_token',token);
    const r=await fetchWithTimeout(url.toString(),{headers:{'xi-api-key':key},cache:'no-store',redirect:'error'},15000);
    if(!r.ok)throw new WaveSpeedError('ELEVENLABS_VOICES_UNAVAILABLE',502);
    const data=await r.json();
    if(!Array.isArray(data.voices))throw new WaveSpeedError('ELEVENLABS_VOICES_UNAVAILABLE');
    for(const v of data.voices)if(typeof v.name==='string' && typeof v.voice_id==='string')voices.push({id:v.voice_id,name:v.name,category:String(v.category??'')});
    if(!data.has_more)return voices;
    if(typeof data.next_page_token!=='string' || data.next_page_token===token)break;
    token=data.next_page_token;
  }
  throw new WaveSpeedError('ELEVENLABS_VOICE_LIST_INCOMPLETE');
}
export async function castOverview() {
  const [{characters,voices},available]=await Promise.all([readCast(),accountVoices()]);
  return {available,characters:characters.map(c=>({...c,assigned:characterVoice(c,voices)}))};
}
export async function assignCharacterVoice(characterId:string, providerVoiceId:string, expectedRowId:string|null) {
  const [{characters,voices},available]=await Promise.all([readCast(),accountVoices()]);
  const character=characters.find(c=>c.id===characterId);
  if(!character || !available.some(v=>v.id===providerVoiceId))throw new WaveSpeedError('INVALID_CHARACTER_VOICE',400);
  if(character.voice_id!==expectedRowId)throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);
  const current=characterVoice(character,voices);
  if(current?.voice_id===providerVoiceId && character.voice_id)return;
  const db=createServerSupabase(),id=randomUUID();
  // Keep the previous voice row: existing recordings must retain their provenance.
  const inserted=await db.from('voices').insert({id,character_id:characterId,provider:'elevenlabs',language:'hu',voice_id:providerVoiceId,provider_voice_id:providerVoiceId,model:'eleven_v3',status:'USER_SELECTED',stability:.5,style:0});
  if(inserted.error)throw new WaveSpeedError('VOICE_DATABASE_UNAVAILABLE');
  let update=db.from('characters').update({voice_id:id}).eq('id',characterId).eq('series_id',SERIES);
  update=expectedRowId ? update.eq('voice_id',expectedRowId) : update.is('voice_id',null);
  const saved=await update.select('id');
  if(saved.error || saved.data?.length!==1)throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);
}
