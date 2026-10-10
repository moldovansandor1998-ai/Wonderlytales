import { describe,it,expect } from 'vitest';
import { dialogueRecording } from '@/lib/dialogueRecording';
import type { Db } from '@/lib/db';
const fixture=()=>{
 const data:any={dialogue_lines:[{id:'d',language:'hu',scene_id:'s',episode_id:'e',character_id:'c',audio_path:'audio/tts/hu/Voice1/abcdefabcdefabcdefabcdef.mp3'}],scenes:[{id:'s',episode_id:'e'}],episodes:[{id:'e',master_language:'hu'}],characters:[{id:'c',voice_id:'v'}],voices:[{id:'v',character_id:'c',language:'hu',provider:'elevenlabs',voice_id:'Voice1'}]};
 const db={get:async(t:string,id:string)=>data[t].find((x:any)=>x.id===id),find:async(t:string,p:any)=>data[t].filter(p)} as unknown as Db;
 return {data,db};
};
describe('Recording ownership',()=>{
 it('resolves the explicitly selected character voice',async()=>{const {db}=fixture();expect((await dialogueRecording(db,'d')).voice.id).toBe('v');});
 it.each(['character','episode','voice','path'])('rejects %s mismatch before fetching audio',async(kind)=>{
  const {db,data}=fixture();
  if(kind==='character')data.dialogue_lines[0].character_id='other';
  if(kind==='episode')data.dialogue_lines[0].episode_id='other';
  if(kind==='voice')data.dialogue_lines[0].audio_path=data.dialogue_lines[0].audio_path.replace('Voice1','Other');
  if(kind==='path')data.dialogue_lines[0].audio_path='audio/tts/hu/Voice1/../../secrets';
  await expect(dialogueRecording(db,'d')).rejects.toThrow();
 });
 it('does not choose an arbitrary voice when no selection resolves ambiguity',async()=>{
  const {db,data}=fixture();delete data.characters[0].voice_id;data.voices.push({...data.voices[0],id:'other'});
  await expect(dialogueRecording(db,'d')).rejects.toThrow('többértelmű');
 });
});
