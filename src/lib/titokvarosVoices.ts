import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { requireStudioUser, createServerSupabase } from './auth';
import { reserveProductionBudget } from './budget';
import { getStorage } from './providers/storage';
import { fetchWithTimeout } from './providers/translation';
import { newVoiceCode, voiceDesigns, titokvarosIds, titokvarosPrefix } from './titokvaros';

export type VoiceAudition = {status:string;code:string;previews?:{id:string;key:string;duration:number;language?:string}[];voice_id?:string;error?:string};
const key=(code:string)=>`${titokvarosPrefix}/voices/${code}/audition.json`;
export async function readVoiceAudition(code:string):Promise<VoiceAudition|null>{
 newVoiceCode(code);const s=getStorage();return await s.exists(key(code))?JSON.parse((await s.get(key(code))).toString()):null;
}
/** Permanent claim: uncertain paid operations never silently restart. */
async function claim(code:string,phase:string){
 const {S3_ENDPOINT,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,S3_BUCKET}=process.env;
 if(!S3_ENDPOINT||!S3_ACCESS_KEY_ID||!S3_SECRET_ACCESS_KEY||!S3_BUCKET)throw new Error('R2 hozzáférés szükséges.');
 const s=new S3Client({endpoint:S3_ENDPOINT,region:'auto',credentials:{accessKeyId:S3_ACCESS_KEY_ID,secretAccessKey:S3_SECRET_ACCESS_KEY},forcePathStyle:true});
 try{await s.send(new PutObjectCommand({Bucket:S3_BUCKET,Key:`${titokvarosPrefix}/voices/${code}/${phase}.claim.json`,Body:JSON.stringify({at:new Date().toISOString(),code,phase}),ContentType:'application/json',IfNoneMatch:'*'}));}
 catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===412)throw new Error('A művelet már elindult. Bizonytalan eredményt nem ismétlünk meg automatikusan.');throw e;}
}
export async function designNewVoice(value:string){
 await requireStudioUser();const code=newVoiceCode(value);const spec=voiceDesigns[code];
 const saved=await readVoiceAudition(code);if(saved?.previews?.length)return;
 if(!process.env.ELEVENLABS_API_KEY)throw new Error('Az ElevenLabs nincs beállítva.');
 if(spec.text.length>180)throw new Error('Túl hosszú hangpróba.');
 // The existing $1 TTS reservation bounds this <=180-character voice audition;
 // no subscriptions, credit purchases, or automatic retry are performed.
 await claim(code,'design');await reserveProductionBudget('tts');
 const storage=getStorage();await storage.put(key(code),JSON.stringify({status:'SUBMISSION_UNCERTAIN',code}),'application/json');
 const r=await fetchWithTimeout('https://api.elevenlabs.io/v1/text-to-voice/design?output_format=mp3_44100_128',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({voice_description:spec.description,text:spec.text,model_id:'eleven_ttv_v3',seed:731,should_enhance:false})},90000);
 if(!r.ok){await storage.put(key(code),JSON.stringify({status:'FAILED',code,error:`ElevenLabs HTTP ${r.status}`}), 'application/json');throw new Error(`A hangtervezés nem sikerült: HTTP ${r.status}`);}
 const data=await r.json() as {previews:{generated_voice_id:string;audio_base_64:string;duration_secs:number;language?:string}[]};
 if(!Array.isArray(data.previews)||data.previews.length<1||data.previews.length>5)throw new Error('Hiányzó hangpróbák.');
 const previews=[];
 for(const [i,p] of data.previews.entries()){
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(p.generated_voice_id)||!Number.isFinite(p.duration_secs)||p.duration_secs<=0||p.duration_secs>60)throw new Error('Érvénytelen hangpróba.');
  const bytes=Buffer.from(p.audio_base_64,'base64');if(bytes.length<100||bytes.length>3_000_000)throw new Error('Érvénytelen hangadat.');
  const path=`${titokvarosPrefix}/voices/${code}/preview_${i}.mp3`;
  await storage.put(path,bytes,'audio/mpeg',{sha256:createHash('sha256').update(bytes).digest('hex')});
  previews.push({id:p.generated_voice_id,key:path,duration:p.duration_secs,language:p.language});
 }
 await storage.put(key(code),JSON.stringify({status:'AUDITION_PENDING',code,previews}),'application/json');
}
export async function selectNewVoice(value:string,index:number){
 await requireStudioUser();const code=newVoiceCode(value);const saved=await readVoiceAudition(code);
 if(saved?.voice_id){await assignVoice(code,saved.voice_id);return;}
 const preview=saved?.previews?.[index];if(!Number.isInteger(index)||!preview)throw new Error('Ismeretlen hangpróba.');
 if(!process.env.ELEVENLABS_API_KEY)throw new Error('Az ElevenLabs nincs beállítva.');
 await claim(code,'select');
 const r=await fetchWithTimeout('https://api.elevenlabs.io/v1/text-to-voice',{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({voice_name:`Titokvaros ${code} V001`,voice_description:voiceDesigns[code].description,generated_voice_id:preview.id,labels:{language:'hu',series:'Titokvaros'}})},45000);
 if(!r.ok){const detail=await r.json().catch(()=>({}));const message=String(detail?.detail?.message??'').slice(0,400);await getStorage().put(key(code),JSON.stringify({...saved,status:'VOICE_SAVE_REJECTED',error:`HTTP ${r.status}: ${message}`}), 'application/json');throw new Error(`A hang mentése sikertelen: HTTP ${r.status}`);}
 const v=await r.json() as {voice_id:string};if(!/^[a-zA-Z0-9]{8,100}$/.test(v.voice_id))throw new Error('Érvénytelen hangazonosító.');
 const result={...saved!,status:'ASSIGNED_PENDING_ACTING_REVIEW',voice_id:v.voice_id};
 // Persist provider result BEFORE the DB update; a recovery can reuse the voice.
 await getStorage().put(key(code),JSON.stringify(result),'application/json');
 await assignVoice(code,v.voice_id);
}
async function assignVoice(code:keyof typeof voiceDesigns,voiceId:string){
 const db=createServerSupabase();const character=titokvarosIds.characters[code];
 const {error}=await db.from('voices').upsert({id:character,character_id:character,provider:'elevenlabs',provider_voice_id:voiceId,voice_id:voiceId,model:'eleven_v3',language:'hu',status:'AUDITION_PENDING',settings:{series:'TITOKVAROS',version:1,review_status:'ACTING_PENDING'},stability:.5,style:0},{onConflict:'id'});
 if(error)throw new Error('A hang elkészült, de az adatbázis mentése javítandó; ne generáld újra.');
}
/** Read-only reconciliation after a create request fails or times out. */
export async function inspectVoiceAccount(){
 await requireStudioUser();if(!process.env.ELEVENLABS_API_KEY)throw new Error('Az ElevenLabs nincs beállítva.');
 const headers={'xi-api-key':process.env.ELEVENLABS_API_KEY};
 const [vr,sr]=await Promise.all([fetchWithTimeout('https://api.elevenlabs.io/v1/voices',{headers},30000),fetchWithTimeout('https://api.elevenlabs.io/v1/user/subscription',{headers},30000)]);
 if(!vr.ok||!sr.ok)throw new Error(`Hangkapacitás nem olvasható: HTTP ${vr.status}/${sr.status}`);
 const v=await vr.json() as {voices:{voice_id:string;name:string;category:string}[]};const s=await sr.json() as {voice_limit:number;voice_add_edit_counter:number;max_voice_add_edits:number;can_extend_voice_limit?:boolean};
 const owned=v.voices.filter(x=>x.category!=='premade'&&x.category!=='professional');
 const status={checked_at:new Date().toISOString(),voice_limit:s.voice_limit,custom_voice_count:owned.length,voice_add_edit_counter:s.voice_add_edit_counter,max_voice_add_edits:s.max_voice_add_edits,production_approved:false};
 await getStorage().put(`${titokvarosPrefix}/voices/account_status.json`,JSON.stringify(status),'application/json');
 for(const code of Object.keys(voiceDesigns) as (keyof typeof voiceDesigns)[]){
  const found=v.voices.filter(x=>x.name===`Titokvaros ${code} V001`);if(found.length!==1)continue;
  const saved=await readVoiceAudition(code);if(!saved||saved.voice_id)continue;
  await getStorage().put(key(code),JSON.stringify({...saved,voice_id:found[0].voice_id,status:'ASSIGNED_PENDING_ACTING_REVIEW'}),'application/json');await assignVoice(code,found[0].voice_id);
 }
 return `Hanghelyek: ${owned.length} / ${s.voice_limit}. Hozzáadások: ${s.voice_add_edit_counter} / ${s.max_voice_add_edits}.`;
}
