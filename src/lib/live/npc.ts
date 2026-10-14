import { joinNpcReaction } from "./npc-media";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { digest, R2VideoStore } from "@/lib/ai-video/storage";
import { downloadProviderMedia } from "@/lib/ai-video/media";
import { retrieveMotion } from "./motion";
import { AvatarError } from "./avatar";
import { MUSIC_GIFT_LINE, NPC_KINDS, GAG_META, type GagKind, type NpcKind } from "./npc-shared";

type Store = Pick<R2VideoStore,"readRecord"|"writeRecord"|"putAsset"|"putChunk"|"completeImage"|"assetBytes">;
type Record = {status:"SUBMITTING"|"PENDING"|"SUCCEEDED"|"FAILED"|"UNCERTAIN"; createdAt:string; taskId?:string; assetId?:string; attempts?:number; providerStatus?:number; error?:string; previousAttempt?:{status:string;taskId?:string;createdAt:string}};
// Keep the original idle records; revised gags get their own immutable asset slots.
export const npcRecordId = (kind:NpcKind) => {
  const index=NPC_KINDS.indexOf(kind);
  return `00000000-0000-4000-8001-${String(kind.startsWith("gag-")?208+index:index+1).padStart(12,"0")}`;
};
const ids = Object.fromEntries(NPC_KINDS.map(kind=>[kind,npcRecordId(kind)])) as {[K in NpcKind]:string};
const base = "One continuous locked-off full body shot. Keep both exact people, masks, hats, rabbit ears, clothes, chair and cabin unchanged. The standing witch wears a blue medical mask, the seated man an opaque black mouth covering. Both masks remain firmly on and opaque. No talking mouth animation, no camera motion, no cuts, no text. Start AND finish in the exact supplied resting pose, with one second of quiet breathing at both ends. ";
const prompts: {[K in NpcKind]:string} = {
  "gag-mud": "0-0.7s: standing Ali brings a wide tray piled high with glossy brown foam shaped like cartoon poop directly under seated Isti's chin. 0.7-1.8s: Ali clearly pushes the back of Isti's hat, plunging his entire masked face DOWN into the soft foam. Huge brown splat shoots sideways. 1.8-4s: Isti pulls his face UP coated in brown foam, eyes wide, fists clenched; Ali points and shakes with laughter. Keep the messy aftermath in the final frame. Show the complete DOWN-THEN-UP action, not a prop being removed.",
  "gag-cream": "0-0.6s: Ali raises TWO whipped cream spray cans and points them at seated Isti. 0.6-2.5s: thick white jets visibly shoot from both cans onto Isti's entire face and hat, building a giant ridiculous mountain of cream. Isti flails his hands. 2.5-4s: Ali plants a bright red cherry on top; Isti angrily parts the cream around his eyes. Keep cream visible at end. Clear cause and effect, broad body gestures.",
  "gag-pie": "0-1s: Ali visibly swings a huge round cream pie from his side toward seated Isti. 1-2s: the pie hits Isti squarely in the masked face with a spectacular white cream explosion, his torso recoils. 2-4s: the plate slowly slides DOWN off his face, revealing furious eyes and a thick cream-covered hat. Ali doubles over laughing. The plate falls only AFTER impact. End on the messy furious reaction, no cleanup.",
  "gag-slime": "0-1s: Ali pulls a hanging rope with a wicked grin in his eyes. 1-2.5s: a large bucket above seated Isti tips and dumps a thick neon-green slime waterfall over his head and shoulders. Huge splashes fill the foreground. 2.5-4s: the now-empty bucket drops onto his hat, Isti raises both arms in outraged disbelief while Ali points and laughs. Slime and bucket remain at end.",
  "gag-spin": "0-0.7s: Ali grabs the back of Isti's chair. 0.7-2.7s: Ali gives one forceful push and the whole chair with seated Isti spins rapidly three complete revolutions like a carnival ride; both feet fly outward. Ali remains stationary behind. 2.7-4s: chair stops facing camera; dizzy Isti sways, his loose pirate hat rotates once more and drops crookedly over his eyes. Complete clear physical spin, not merely a head turn.",
  "gag-confetti": "0-1s: Ali aims an oversized gold PARTY CONFETTI tube upward beside Isti's shoulder. 1-2s: a spectacular colorful burst of long ribbons and confetti explodes around Isti, his whole body jumps. 2-4s: ribbons tangle his arms, head and hat into a ridiculous gift-wrapped package; only angry eyes show. He struggles to lift his arms while Ali proudly presents him to camera. Colorful paper, no weapon or injury.",
  "gag-galaxy": "0-1.5s: Isti rises slightly from his chair; Ali lifts one leg behind him. 1.5-2s: Ali gives a clearly visible theatrical kick to Isti's padded backside. 2-4s: Isti flies upward out of frame with arms flailing, trailing a bright purple-blue GALAXY of stars and spiral nebulae. His hat follows late. 4-6s: Isti drops back onto the chair amid a puff of cosmic glitter, hat lands sideways on his head; he shakes his fist at Ali. Funny cartoon physics, safe stage stunt. Kick then flight then landing, clear chronology.",
  "gag-tornado": "0-1s: Ali whisks a giant cream bowl with a magic spoon. 1-3s: a huge twisting WHITE WHIPPED-CREAM TORNADO erupts and spins around seated Isti from boots to hat; he flails both arms and lifts slightly with the chair. 3-5s: the tornado collapses into a mountain of cream covering Isti and chair. 5-6s: Isti pushes his eyes out of the cream and glares at Ali, who adds a tiny cherry. Broad, fast, spectacular slapstick.",
  "gag-bubble": "0-1s: Ali blows through a giant soap-bubble wand toward Isti. 1-3s: an enormous iridescent bubble envelops Isti AND his chair and lifts them a meter; he presses his hands against the bubble, furious. 3-4.5s: Ali pokes it with one finger; it bursts into a spectacular spray of glittering foam. 4.5-6s: chair and Isti bounce down onto a huge soft cushion, his hat bounces late. Ali bows proudly. Exaggerated funny safe physics.",
  "gag-rocket": "0-1.5s: Ali attaches an absurd red TOY ROCKET beneath Isti's chair and pushes a giant button. 1.5-3.5s: bright gold sparkles and purple stage smoke erupt; chair and Isti shoot straight upward, legs flailing, leaving a circular smoke ring. 3.5-5s: the chair descends under a tiny ridiculous rainbow parachute. 5-6s: Isti lands safely with a huge cushion bounce and points furiously at Ali. Cinematic lighting, glitter trails, entire set reacts. No fire damage, no injury.",
  "gag-meteor": "0-1s: Ali sweeps his arms upward like an overconfident conductor. 1-3s: three enormous whipped-cream pies streak down like glowing pastel meteors, hitting Isti's hat, shoulders and chair in separate explosive cream splashes. 3-5s: a final GIANT pie falls over Isti, erupting in a huge white foam cloud that fills most of the room. 5-6s: the cloud clears to reveal only Isti's furious eyes and crooked hat in a cream mountain; Ali holds up a tiny dessert spoon. Comical foam props, no injury.",
  "idle-breathe": "Very subtle natural breathing and a single blink. The seated man keeps his arms folded, the witch calmly watches. No broad gestures. Return precisely to the starting pose.",
  "idle-glance": "The seated man briefly glances up at the witch with his eyes, then looks forward again. The witch gives one tiny head tilt then returns. Barely perceptible breathing. Return precisely to the starting pose.",
  "idle-shrug": "The seated man makes one tiny disgruntled shoulder adjustment while keeping arms folded, then relaxes. The witch blinks, barely moving. Return precisely to the starting pose.",
  "music-gift": "Comedic angry reaction. At 1 second the seated man uncrosses his arms and stands up in front of the chair. At 2 to 5 seconds he stands and gestures angrily at an annoying noise, with one open palm, frustrated raised eyebrows. At 5 seconds he lowers his hands and sits back down. By 7 seconds he has folded his arms and regained the EXACT starting seated pose. The witch remains in place watching amused. Both people stay fully in frame, masks and hats stay on.",
};
export function npcPayload(kind:NpcKind, image:string) {
  const gag=kind.startsWith("gag-");
  return {model:"veo3.1_fast",duration:gag?GAG_META[kind as GagKind].duration:8,ratio:"720:1280",audio:false,
    promptText:(gag ? "Professional slapstick AI parody. Fixed vertical camera, exact same two men, costumes, masks and cabin as reference. Ali stands left in blue medical mask; Isti sits right with black mask and pirate hat. Preserve identities and masks. Big readable fast action, no text, no talking. " : base)+prompts[kind],
    // Gags play forward to an aftermath; matching first/last frames had reversed the action.
    promptImage:gag?[{uri:image,position:"first"}]:[{uri:image,position:"first"},{uri:image,position:"last"}]};
}
const voiceRecordId = (voiceId:string) => {const hash=digest(`npc-music-gift-v1:${voiceId}`);return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};
export async function startNpcClip(store:Store, kind:NpcKind, retry=false) {
  if(kind==="music-gift")return startNpcReaction(store);
  const id=ids[kind],old=await store.readRecord<Record>("live-backdrop",id);
  if(old&&!retry)return old.value;
  if(retry&&(!kind.startsWith("gag-")||!old||!["FAILED","UNCERTAIN"].includes(old.value.status)||(old.value.attempts||1)>=2))throw new AvatarError("NPC_RETRY_NOT_ALLOWED",409);
  if(!process.env.RUNWAYML_API_SECRET)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const service=kind.startsWith("gag-")&&GAG_META[kind as GagKind].duration===4?"runway_npc_4s":"runway_npc_8s";
  const budget=await getProductionBudget();
  if(!budget||(budget.configured_services[service]??0)<(service==="runway_npc_4s"?0.4:0.8))throw new AvatarError("NPC_BUDGET_NOT_CONFIGURED",409);
  const image=await readFile(path.join(process.cwd(),"public/live-studio/ali-isti-masked.webp"));
  if(kind==="idle-breathe"){const sha=digest(image);await store.putChunk(sha,0,image);await store.completeImage(sha,image.length);}
  const record:Record={status:"SUBMITTING",createdAt:new Date().toISOString(),attempts:(old?(old.value.attempts||1):0)+1,...(old?{previousAttempt:{status:old.value.status,taskId:old.value.taskId,createdAt:old.value.createdAt}}:{})};
  if(!await store.writeRecord("live-backdrop",id,record,retry?old!.etag:undefined))return (await store.readRecord<Record>("live-backdrop",id))!.value;
  const claim=await store.readRecord<Record>("live-backdrop",id);
  if(!claim)throw new AvatarError("NPC_UNCERTAIN",409);
  let providerStatus:number|undefined,providerError:string|undefined;
  try {
    await reserveProductionBudget(service);
    const response=await fetch("https://api.dev.runwayml.com/v1/image_to_video",{method:"POST",signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.RUNWAYML_API_SECRET}`,"X-Runway-Version":"2024-11-06","Content-Type":"application/json"},body:JSON.stringify(npcPayload(kind,`data:image/webp;base64,${image.toString("base64")}`))});
    if(!response.ok){
      providerStatus=response.status;
      const body=await response.json().catch(()=>({}));
      const detail=typeof body.error==="string"?body.error:typeof body.message==="string"?body.message:"";
      providerError=/credit|insufficient/i.test(detail)?"NPC_CREDITS_REQUIRED":response.status===429||/rate|concurren|capacity/i.test(detail)?"NPC_CAPACITY_LIMIT":"NPC_GENERATION_FAILED";
      console.warn("live_npc_rejected",{kind,status:providerStatus,error:providerError});
      throw new AvatarError(providerError,503);
    }
    const taskId=z.string().uuid().parse((await response.json()).id);
    const next:Record={...record,status:"PENDING",taskId};
    if(!await store.writeRecord("live-backdrop",id,next,claim.etag))throw new AvatarError("NPC_UNCERTAIN",409);
    return next;
  }catch(error){await store.writeRecord("live-backdrop",id,{...record,status:providerStatus&&providerStatus<500?"FAILED":"UNCERTAIN",providerStatus,error:providerError},claim.etag);throw error;}
}
export async function startNpcVoice(store:Store,voiceId:string) {
  const id=voiceRecordId(voiceId),old=await store.readRecord<Record>("live-backdrop",id);
  if(old)return old.value;
  if(!process.env.ELEVENLABS_API_KEY)throw new AvatarError("VOICE_PROVIDER_ERROR");
  const record:Record={status:"SUBMITTING",createdAt:new Date().toISOString()};
  if(!await store.writeRecord("live-backdrop",id,record))return (await store.readRecord<Record>("live-backdrop",id))!.value;
  const claim=await store.readRecord<Record>("live-backdrop",id);
  if(!claim)throw new AvatarError("NPC_UNCERTAIN",409);
  try {
    await reserveProductionBudget("tts");
    const response=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,{method:"POST",signal:AbortSignal.timeout(60000),headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({text:`[angry] [shouting] ${MUSIC_GIFT_LINE}`,model_id:"eleven_v3",language_code:"hu",voice_settings:{stability:0.5,similarity_boost:0.8}})});
    if(!response.ok)throw new AvatarError("VOICE_PROVIDER_ERROR");
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<100||bytes.length>4_000_000)throw new AvatarError("VOICE_PROVIDER_ERROR");
    const assetId=digest(bytes);await store.putAsset(assetId,"mp3",bytes);
    const next:Record={...record,status:"SUCCEEDED",assetId};
    if(!await store.writeRecord("live-backdrop",id,next,claim.etag))throw new AvatarError("NPC_UNCERTAIN",409);
    return next;
  }catch(error){await store.writeRecord("live-backdrop",id,{...record,status:"UNCERTAIN"},claim.etag);throw error;}
}
async function readAsset(store:Store,id:string,extension:"mp4"|"mp3") {
  const saved=await store.readRecord<Record>("live-backdrop",id);
  if(!saved)return {status:"MISSING"};
  if(saved.value.assetId)return {status:"SUCCEEDED",url:`/api/ai-video/assets/${saved.value.assetId}${extension==="mp3"?"?type=mp3":""}`};
  if(!saved.value.taskId||saved.value.status!=="PENDING")return {status:saved.value.status,error:saved.value.error,attempts:saved.value.attempts||1};
  const task=await retrieveMotion(saved.value.taskId);
  if(task.status==="FAILED"||task.status==="CANCELLED"){
    await store.writeRecord("live-backdrop",id,{...saved.value,status:"FAILED"},saved.etag);return {status:"FAILED"};
  }
  if(task.status!=="SUCCEEDED"||!task.url)return {status:"PENDING"};
  const bytes=await downloadProviderMedia(task.url,100*1024*1024);
  if(bytes.length<100||bytes.toString("ascii",4,8)!=="ftyp")throw new AvatarError("MOTION_INVALID_VIDEO");
  const assetId=digest(bytes);await store.putAsset(assetId,"mp4",bytes);
  await store.writeRecord("live-backdrop",id,{...saved.value,status:"SUCCEEDED",assetId},saved.etag);
  return {status:"SUCCEEDED",url:`/api/ai-video/assets/${assetId}`};
}
export async function readNpc(store:Store,voiceId:string) {
  const clips=await Promise.all(NPC_KINDS.map(async kind=>({kind,...await (kind==="music-gift"?readNpcReaction(store):readAsset(store,ids[kind],"mp4"))})));
  const voice=await readAsset(store,voiceRecordId(voiceId),"mp3");
  return {clips,voice,ready:clips.filter(c=>!c.kind.startsWith("gag-")).every(c=>c.status==="SUCCEEDED")&&voice.status==="SUCCEEDED"};
}

const REACTION_MASTER="00000000-0000-4000-8001-000000000104";
const reactionIds=["00000000-0000-4000-8001-000000000105","00000000-0000-4000-8001-000000000106","00000000-0000-4000-8001-000000000107"];
export function reactionPayload(part:number,seated:string,standing:string){
  const actions=[
    "The man on the right silently uncrosses his arms, leans forward, stands up completely from the chair, straightens both knees, and ends fully upright in the supplied standing pose. The chair remains behind him. No speech. One natural continuous rising movement.",
    "The man on the right remains standing upright with both knees straight in front of the empty chair. He silently moves one open palm a little outward in an irritated shrug, then returns to the exact supplied standing pose. All motion is in shoulders, arms and eyes. His face covering stays perfectly still.",
    "The man on the right silently lowers his hands, bends his knees, sits down on the chair behind him and folds his arms exactly as in the final seated image. One natural continuous sitting movement."
  ];
  return {model:"veo3.1_fast",duration:4,ratio:"720:1280",audio:false,promptText:"Locked-off full body shot, identical cabin, clothes and lighting. Both masks stay completely opaque and intact. Isti's black cloth is a plain solid black surface covering his whole mouth and chin, without any opening, markings, lips or teeth. The blue masked witch stays in place. No mouth movement, no speech, no camera movement, no cuts, no text. "+actions[part],promptImage:[{uri:part===0?seated:standing,position:"first"},{uri:part===2?seated:standing,position:"last"}]};
}
async function startNpcReaction(store:Store){
  const master=await store.readRecord<Record>("live-backdrop",REACTION_MASTER);if(master)return master.value;
  const budget=await getProductionBudget();
  if(!budget||(budget.configured_services.runway_npc_4s??0)<0.4)throw new AvatarError("NPC_BUDGET_NOT_CONFIGURED",409);
  if(!process.env.RUNWAYML_API_SECRET)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const [seated,standing]=await Promise.all([readFile(path.join(process.cwd(),"public/live-studio/ali-isti-masked.webp")),readFile(path.join(process.cwd(),"public/live-studio/ali-isti-standing.webp"))]);
  const sha=digest(standing);await store.putChunk(sha,0,standing);await store.completeImage(sha,standing.length);
  for(let part=0;part<3;part++){
    const id=reactionIds[part],old=await store.readRecord<Record>("live-backdrop",id);if(old){if(["UNCERTAIN","FAILED"].includes(old.value.status))return old.value;continue;}
    const record:Record={status:"SUBMITTING",createdAt:new Date().toISOString()};
    if(!await store.writeRecord("live-backdrop",id,record))continue;
    const claim=await store.readRecord<Record>("live-backdrop",id);if(!claim)throw new AvatarError("NPC_UNCERTAIN",409);
    try{
      await reserveProductionBudget("runway_npc_4s");
      const response=await fetch("https://api.dev.runwayml.com/v1/image_to_video",{method:"POST",signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${process.env.RUNWAYML_API_SECRET}`,"X-Runway-Version":"2024-11-06","Content-Type":"application/json"},body:JSON.stringify(reactionPayload(part,`data:image/webp;base64,${seated.toString("base64")}`,`data:image/webp;base64,${standing.toString("base64")}`))});
      if(!response.ok)throw new AvatarError("NPC_GENERATION_FAILED");
      const taskId=z.string().uuid().parse((await response.json()).id);
      if(!await store.writeRecord("live-backdrop",id,{...record,status:"PENDING",taskId},claim.etag))throw new AvatarError("NPC_UNCERTAIN",409);
    }catch(error){await store.writeRecord("live-backdrop",id,{...record,status:"UNCERTAIN"},claim.etag);throw error;}
  }
  return {status:"PENDING"};
}
async function readNpcReaction(store:Store){
  const master=await store.readRecord<Record>("live-backdrop",REACTION_MASTER);
  if(master?.value.assetId)return {status:"SUCCEEDED",url:`/api/ai-video/assets/${master.value.assetId}`};
  const parts=await Promise.all(reactionIds.map(id=>readAsset(store,id,"mp4")));
  for(const status of ["UNCERTAIN","FAILED","MISSING","SUBMITTING","PENDING"]){if(parts.some(p=>p.status===status))return {status};}
  const records=await Promise.all(reactionIds.map(id=>store.readRecord<Record>("live-backdrop",id)));
  const bytes=await joinNpcReaction(await Promise.all(records.map(record=>store.assetBytes(record!.value.assetId!,"mp4"))));
  const assetId=digest(bytes);await store.putAsset(assetId,"mp4",bytes);
  await store.writeRecord("live-backdrop",REACTION_MASTER,{status:"SUCCEEDED",createdAt:new Date().toISOString(),assetId});
  return {status:"SUCCEEDED",url:`/api/ai-video/assets/${assetId}`};
}
