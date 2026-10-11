import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { requireStudioUser } from './auth';
import { reserveProductionBudget } from './budget';
import { getStorage } from './providers/storage';
import { fetchWithTimeout } from './providers/translation';
import { titokvarosDemo as demo, titokvarosPrefix } from './titokvaros';
import { readVoiceAudition } from './titokvarosVoices';
export type AlignedLine={status:string;id:string;key?:string;sha256?:string;voice_id?:string;duration_sec?:number;alignment?:{characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]};error?:string};
export function demoLine(id:string){const line=demo.dialogue.find(x=>x.id===id);if(!line)throw new Error('Ismeretlen bemutatómondat.');return line;}
export function demoLineKey(id:string){demoLine(id);return `${titokvarosPrefix}/dialogue/${id}`;}
export async function readDemoLine(id:string):Promise<AlignedLine|null>{const key=demoLineKey(id)+'.json';const s=getStorage();return await s.exists(key)?JSON.parse((await s.get(key)).toString()):null;}
export async function recordDemoLine(id:string){
 await requireStudioUser();const line=demoLine(id);const saved=await readDemoLine(id);if(saved?.status==='RECORDED_PENDING_REVIEW')return;
 const voice=await readVoiceAudition(line.character);if(!voice?.voice_id)throw new Error('Előbb szükséges az új karakter próbahangja.');
 if(!process.env.ELEVENLABS_API_KEY)throw new Error('Az ElevenLabs nincs beállítva.');
 if(line.text.length>250)throw new Error('Túl hosszú mondat.');
 const {S3_ENDPOINT,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,S3_BUCKET}=process.env;
 if(!S3_ENDPOINT||!S3_ACCESS_KEY_ID||!S3_SECRET_ACCESS_KEY||!S3_BUCKET)throw new Error('R2 hozzáférés szükséges.');
 const s=new S3Client({endpoint:S3_ENDPOINT,region:'auto',credentials:{accessKeyId:S3_ACCESS_KEY_ID,secretAccessKey:S3_SECRET_ACCESS_KEY},forcePathStyle:true});
 const key=demoLineKey(id);const storage=getStorage();
 try{await s.send(new PutObjectCommand({Bucket:S3_BUCKET,Key:key+'.claim.json',Body:JSON.stringify({id,at:new Date().toISOString()}),ContentType:'application/json',IfNoneMatch:'*'}));}
 catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===412)throw new Error('A mondat felvétele már elindult. Előbb ellenőrizd a mentett eredményt.');throw e;}
 await reserveProductionBudget('tts_dialogue');
 await storage.put(key+'.json',JSON.stringify({id,status:'SUBMISSION_UNCERTAIN'}),'application/json');
 const r=await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:line.text,model_id:'eleven_v3',language_code:'hu',seed:731,voice_settings:{stability:.5,similarity_boost:.75,use_speaker_boost:true}})},90000);
 if(!r.ok){await storage.put(key+'.json',JSON.stringify({id,status:'FAILED',error:`ElevenLabs HTTP ${r.status}`}), 'application/json');throw new Error(`A felvétel nem sikerült: HTTP ${r.status}`);}
 const result=await r.json() as {audio_base64:string;alignment:NonNullable<AlignedLine['alignment']>};const a=result.alignment;
 if(!a||!Array.isArray(a.characters)||a.characters.length!==a.character_start_times_seconds?.length||a.characters.length!==a.character_end_times_seconds?.length||a.characters.length<1)throw new Error('Hiányzó beszédidőzítés.');
 if(a.character_start_times_seconds.some((t,i)=>!Number.isFinite(t)||t<0||t>a.character_end_times_seconds[i]||(i>0&&t<a.character_start_times_seconds[i-1]))||a.character_end_times_seconds.some(t=>!Number.isFinite(t)||t>12))throw new Error('Érvénytelen beszédidőzítés.');
 const audio=Buffer.from(result.audio_base64,'base64');if(audio.length<100||audio.length>2_000_000)throw new Error('Érvénytelen hangadat.');
 const sha256=createHash('sha256').update(audio).digest('hex');await storage.put(key+'.mp3',audio,'audio/mpeg',{sha256});
 await storage.put(key+'.json',JSON.stringify({id,status:'RECORDED_PENDING_REVIEW',key:key+'.mp3',sha256,voice_id:voice.voice_id,text:line.text,at:line.at,direction:line.direction,duration_sec:Math.max(...a.character_end_times_seconds),alignment:a,production_approved:false}), 'application/json');
}
