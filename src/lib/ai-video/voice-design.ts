import {z} from 'zod';
import {CAST,type CastKey} from './episode-shared';
import {R2VideoStore,digest} from './storage';
import {readCast,accountVoices,assignCharacterVoice} from './voices';
import {reserveProductionBudget} from '../budget';
import {WaveSpeedError} from '../providers/wavespeed';
export const VOICE_DESIGNS={
 felix:{old:'tWNlc7uUtaorMxxrhH9s',oldName:'Morzsi',description:'Original adult male Hungarian animated film actor, age 28. Warm medium-low baritone, lightly textured, clever and charming with playful dry wit. A streetwise red fox with hidden kindness. Expressive but grounded, quick natural reactions, never a caricature. Native standard Hungarian pronunciation, also fluent clear English while keeping the same vocal identity. Clean close studio recording, no music.',sample:'Hűha! Ez aztán közel volt! Mi folyik itt ma? Nyugalom, Félix, csak egy rossz kanyar. Vagy mégsem? Ha követni akarsz, lépj csendesen. Ebben a városban a falaknak is fülük van.'},
 mira:{old:'jcrKkDTF93Hvb8jBABwM',oldName:'Lili',description:'Original adult female Hungarian animated film actor, age 29. Clear focused mid-range voice, confident observant police detective with quiet warmth. Decisive crisp diction, intelligent understated humor and believable tender moments. Not childish or squeaky. Native standard Hungarian and fluent clear English with consistent identity. Clean intimate studio recording, no music.',sample:'Állj meg, Félix! Nem mindenki az ellenséged, aki kérdez. Láttam azt az autót. És azt is, amit elrejtettél. Most az egyszer mondd el az igazat. Talán együtt megtaláljuk a választ.'},
 nera:{old:'gvuelryL3NskaN44p9vz',oldName:'Pötty',description:'Original adult female Hungarian animated film actor, age 40. Rich smooth low mezzo voice, elegant controlled art dealer, subtly mysterious and perceptive. Unhurried precise delivery, velvet warmth with restrained tension, never whispery or melodramatic. Native standard Hungarian and fluent English with the same identity. Clean studio recording, no music.',sample:'Minden tárgynak van története, Félix. Ennek azonban ára is van. Nézd meg közelebbről a jelet. Valaki nagyon szeretné, ha ma este ez a kis titok örökre eltűnne a városból.'},
 tilda:{old:'8ik405hgdHADnz9lglMf',oldName:'Zizi',description:'Original adult FEMALE Hungarian animated film actor, age 48. Grounded warm contralto with gentle natural huskiness, practical resourceful pangolin mechanic. Motherly but not elderly, cheerful directness and dry humor, firm when danger approaches. Clearly female, not a male voice. Native standard Hungarian and fluent English, consistent identity. Clean studio recording, no music.',sample:'Tedd csak ide azt az alkatrészt, aranyom. Amit más eldob, abból én még csodát csinálok. De ezt a jeladót ne kapcsold be! Előbb tudnunk kell, hogy ki figyel a másik oldalon.'},
 oszkar:{old:'vmhWRuUG7LqpLLPY9sM1',oldName:'Márk',description:'Original young ADULT male Hungarian animated film actor, age 23. Bright agile light tenor, energetic squirrel bicycle courier with lovable nervous humor. Fast but intelligible, youthful without childish squeaks, sincere courage beneath the jokes. Native standard Hungarian, also fluent clear English with same identity. Clean studio recording, no music.',sample:'Én csak egy csomagot hoztam! Jó, meg talán egy kis bajt is. De tudok egy rövidebb utat a műhelyhez. Kapaszkodjatok! Titokvárosban a legjobb futár mindig talál egy nyitott kaput.'},
} as const;
export type VoiceDesign={id:string;key:CastKey;name:string;status:'DESIGNING'|'PREVIEWS'|'ACTIVATING'|'ACTIVE'|'UNCERTAIN'|'FAILED';previews?:{id:string;asset:string;duration:number}[];newVoiceId?:string;oldRemoved?:boolean;oldArchived?:boolean;oldMetadata?:unknown;expectedRowId:string|null;error?:string};
async function eleven(path:string,body?:unknown,method?:string){
 const key=process.env.ELEVENLABS_API_KEY;if(!key)throw new WaveSpeedError('ELEVENLABS_NOT_CONFIGURED',503);
 const r=await fetch('https://api.elevenlabs.io'+path,{method:method??(body?'POST':'GET'),headers:{'xi-api-key':key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(90000)});
 if(!r.ok){const problem=await r.json().catch(()=>({}));const code=String(problem?.detail?.status??problem?.detail?.[0]?.type??'UNKNOWN').toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,70);throw new WaveSpeedError(r.status===402?'VOICE_CREDITS_REQUIRED':r.status===400||r.status===422?'VOICE_REJECTED_'+code:'VOICE_SERVICE_FAILED',502);}
 return r.status===204?{}:r.json();
}
export async function voiceDesignOverview(store:R2VideoStore){
 const records=await store.listRecords<VoiceDesign>('voice-design');
 const subscription=await eleven('/v1/user/subscription');
 return Object.entries(VOICE_DESIGNS).map(([key,d])=>({key,name:CAST[key as CastKey].name,description:d.description,voiceLimit:subscription.voice_limit,voiceCount:subscription.voice_slots_used,oldVoiceId:d.old,oldName:d.oldName,record:records.find(r=>r.key===key)?((({oldMetadata,...safe})=>safe)(records.find(r=>r.key===key)!)):null}));
}
export async function designVoice(raw:unknown,store:R2VideoStore){
 const {key,action,preview,confirmOldVoiceId}=z.object({key:z.enum(['felix','mira','nera','tilda','oszkar']),action:z.enum(['design','activate','replace']),confirmOldVoiceId:z.string().optional(),preview:z.number().int().min(0).max(2).optional()}).strict().parse(raw);
 const spec=VOICE_DESIGNS[key],characterId=CAST[key].id;
 const old=await store.readRecord<VoiceDesign>('voice-design',characterId);
 let rec=old?.value;
 async function save(next:VoiceDesign){const r=await store.readRecord<VoiceDesign>('voice-design',characterId);if(!await store.writeRecord('voice-design',characterId,next,r?.etag))throw new WaveSpeedError('SCENE_CHANGED',409);rec=next;}
 if(action==='design'){
  if(rec)return voiceDesignOverview(store);
  const [{characters},available]=await Promise.all([readCast(),accountVoices()]);
  const character=characters.find(c=>c.id===characterId),source=available.find(v=>v.id===spec.old);
  if(!character||!source?.name.includes(spec.oldName)||!source.name.includes('Wonderly'))throw new WaveSpeedError('VOICE_SCOPE_CHANGED',409);
  const sub=await eleven('/v1/user/subscription');
  if(sub.character_limit-sub.character_count<spec.sample.length*3)throw new WaveSpeedError('VOICE_CREDITS_REQUIRED',409);
  const next:VoiceDesign={id:characterId,key,name:`WonderlyTales – ${CAST[key].name} V002`,status:'DESIGNING',expectedRowId:character.voice_id,oldMetadata:await eleven('/v1/voices/'+spec.old)};
  if(!await store.writeRecord('voice-design',characterId,next))return voiceDesignOverview(store);
  rec=next;
  try{
   await reserveProductionBudget('voice_design');
   const data=await eleven('/v1/text-to-voice/design',{voice_description:spec.description,text:spec.sample,model_id:'eleven_ttv_v3',seed:731+Object.keys(CAST).indexOf(key),guidance_scale:5});
   const previews=[];
   for(const p of (data.previews??[]).slice(0,3)){
    if(!/^[A-Za-z0-9_-]+$/.test(p.generated_voice_id)||typeof p.audio_base_64!=='string'||p.audio_base_64.length>12000000)throw new Error('Invalid preview');
    const bytes=Buffer.from(p.audio_base_64,'base64'),asset=digest(bytes);await store.putAsset(asset,'mp3',bytes);previews.push({id:p.generated_voice_id,asset,duration:p.duration_secs});
   }
   if(!previews.length)throw new Error('Empty previews');
   await save({...rec,status:'PREVIEWS',previews});
  }catch(e){await save({...rec,status:'UNCERTAIN',error:e instanceof WaveSpeedError?e.code:'VOICE_DESIGN_UNCERTAIN'});}
 }else{
  if(!rec)throw new WaveSpeedError('VOICE_PREVIEW_REQUIRED',409);
  if(rec.status==='ACTIVE')return voiceDesignOverview(store);
  if(rec.status!=='PREVIEWS'&&!(rec.status==='UNCERTAIN'&&!rec.newVoiceId&&(rec.error==='VOICE_DESIGN_REJECTED'||rec.error?.startsWith('VOICE_REJECTED_'))))throw new WaveSpeedError('JOB_ACTIVE',409);
  const selected=rec.previews?.[preview??0];if(!selected)throw new WaveSpeedError('INVALID_INPUT',400);
  if(action==='replace'&&confirmOldVoiceId!==spec.old)throw new WaveSpeedError('VOICE_REPLACEMENT_CONFIRMATION_REQUIRED',409);
  const activation={...rec,status:'ACTIVATING' as const};
  if(!await store.writeRecord('voice-design',characterId,activation,old!.etag))throw new WaveSpeedError('SCENE_CHANGED',409);
  rec=activation;
  try{
   if(action==='replace'){
    if(confirmOldVoiceId!==spec.old)throw new WaveSpeedError('VOICE_REPLACEMENT_CONFIRMATION_REQUIRED',409);
    const subscription=await eleven('/v1/user/subscription');
    if(subscription.voice_slots_used>subscription.voice_limit)throw new WaveSpeedError('VOICE_ACCOUNT_OVER_LIMIT',409);
    if(subscription.max_voice_add_edits!==null&&subscription.max_voice_add_edits!==undefined&&subscription.voice_add_edit_counter>=subscription.max_voice_add_edits)throw new WaveSpeedError('VOICE_EDIT_LIMIT_REACHED',409);
    const {characters}=await readCast();if(characters.find(c=>c.id===characterId)?.voice_id!==rec.expectedRowId)throw new WaveSpeedError('VOICE_ASSIGNMENT_CHANGED',409);
    const existing=await eleven('/v1/voices/'+spec.old);
    if(!String(existing.name).includes(spec.oldName)||!String(existing.name).includes('Wonderly'))throw new WaveSpeedError('VOICE_SCOPE_CHANGED',409);
    await eleven('/v1/voices/'+spec.old,undefined,'DELETE');
    await save({...rec,oldRemoved:true});
   }
   const voice=await eleven('/v1/text-to-voice',{voice_name:rec.name,voice_description:spec.description,generated_voice_id:selected.id,labels:{language:'hu',use_case:'characters_animation'}});
   if(typeof voice.voice_id!=='string')throw new Error('Invalid voice');
   await save({...rec,newVoiceId:voice.voice_id});
   await assignCharacterVoice(characterId,voice.voice_id,rec.expectedRowId);
   // Preserve historical voices; only the five authorized IDs receive archive names.
   if(rec.oldRemoved){await save({...rec,status:'ACTIVE'});return voiceDesignOverview(store);}
   const form=new FormData();form.set('name',`ARCHÍV – WonderlyTales – ${spec.oldName} V001`);
   const archived=await fetch('https://api.elevenlabs.io/v1/voices/'+spec.old+'/edit',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY!},body:form,signal:AbortSignal.timeout(20000),redirect:'error'});
   await save({...rec,status:'ACTIVE',oldRemoved:false,oldArchived:archived.ok});
  }catch(e){await save({...rec,status:'UNCERTAIN',error:e instanceof WaveSpeedError?e.code:'VOICE_ACTIVATION_UNCERTAIN'});}
 }
 return voiceDesignOverview(store);
}
