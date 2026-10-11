import { z } from 'zod';
import { characterVoice,readCast } from './voices';
import { digest,R2VideoStore } from './storage';
import { WaveSpeedError } from '../providers/wavespeed';
import { fetchWithTimeout } from '../providers/translation';
import { isProduction } from '../config';
import { reserveProductionBudget } from '../budget';
export type DialogueRecording={id:string;characterId:string;voiceId:string;voiceRowId:string;text:string;model:'eleven_v3';status:'SUBMITTING'|'COMPLETED'|'FAILED'|'UNCERTAIN';sha256?:string;duration?:number;alignment?:{characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]}};
const inputSchema=z.object({characterId:z.string().uuid(),expectedVoiceId:z.string(),text:z.string().trim().min(1).max(250)}).strict();
export async function recordCharacterDialogue(raw:unknown,store:R2VideoStore):Promise<DialogueRecording> {
  const input=inputSchema.parse(raw),{characters,voices}=await readCast();
  const character=characters.find(c=>c.id===input.characterId);
  const voice=character && characterVoice(character,voices);
  if(!voice)throw new WaveSpeedError('CHARACTER_VOICE_MISSING',409);
  if(input.expectedVoiceId!==voice.voice_id)throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);
  const key=process.env.ELEVENLABS_API_KEY;
  if(!key || !isProduction())throw new WaveSpeedError('ELEVENLABS_NOT_CONFIGURED',503);
  const model='eleven_v3' as const;
  const id=digest(JSON.stringify({characterId:character!.id,voiceRowId:voice.id,voiceId:voice.voice_id,text:input.text,model}));
  const old=await store.readDialogue<DialogueRecording>(id);if(old)return old;
  let result:DialogueRecording={id,characterId:character!.id,voiceId:voice.voice_id,voiceRowId:voice.id,text:input.text,model,status:'SUBMITTING'};
  if(!await store.claimDialogue(id,result))return (await store.readDialogue<DialogueRecording>(id))!;
  try {await reserveProductionBudget('tts_dialogue');}
  catch {result={...result,status:'FAILED'};await store.saveDialogue(id,result);return result;}
  // No fallback voice and no automatic retries. The immutable record is the charge claim.
  try {
    const r=await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',redirect:'error',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:input.text,model_id:model,language_code:'hu',seed:731,voice_settings:{stability:.5,similarity_boost:.75,use_speaker_boost:true}})},90000);
    if(!r.ok){result={...result,status:'FAILED'};await store.saveDialogue(id,result);return result;}
    const data=await r.json();
    const a=z.object({characters:z.array(z.string()).min(1),character_start_times_seconds:z.array(z.number().finite().nonnegative()),character_end_times_seconds:z.array(z.number().finite().nonnegative().max(60))}).parse(data.alignment);
    if(a.characters.length!==a.character_start_times_seconds.length || a.characters.length!==a.character_end_times_seconds.length || a.character_start_times_seconds.some((t,i)=>t>a.character_end_times_seconds[i] || (i>0 && t<a.character_start_times_seconds[i-1])))throw new Error('Invalid alignment');
    if(typeof data.audio_base64!=='string' || data.audio_base64.length>3000000)throw new Error('Invalid audio');
    const audio=Buffer.from(data.audio_base64,'base64');if(audio.length<100)throw new Error('Invalid audio');
    await store.putDialogueAudio(id,audio);
    result={...result,status:'COMPLETED',sha256:digest(audio),duration:Math.max(...a.character_end_times_seconds),alignment:a};
    await store.saveDialogue(id,result);return result;
  }catch {
    const latest=await store.readDialogue<DialogueRecording>(id);if(latest?.status==='COMPLETED')return latest;
    result={...result,status:'UNCERTAIN'};await store.saveDialogue(id,result);return result;
  }
}
