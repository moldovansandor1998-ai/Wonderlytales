import { joinNpcReaction } from "./npc-media";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getProductionBudget, reserveProductionBudget } from "@/lib/budget";
import { digest, R2VideoStore } from "@/lib/ai-video/storage";
import { downloadProviderMedia } from "@/lib/ai-video/media";
import { retrieveMotion } from "./motion";
import { AvatarError } from "./avatar";
import { MUSIC_GIFT_LINE, NPC_KINDS, type NpcKind } from "./npc-shared";

type Store = Pick<R2VideoStore,"readRecord"|"writeRecord"|"putAsset"|"putChunk"|"completeImage"|"assetBytes">;
type Record = {status:"SUBMITTING"|"PENDING"|"SUCCEEDED"|"FAILED"|"UNCERTAIN"; createdAt:string; taskId?:string; assetId?:string};
const ids = Object.fromEntries(NPC_KINDS.map((kind,i)=>[kind,`00000000-0000-4000-8001-00000000000${i+1}`])) as {[K in NpcKind]:string};
const base = "One continuous locked-off full body shot. Keep both exact people, masks, hats, rabbit ears, clothes, chair and cabin unchanged. The standing witch wears a blue medical mask, the seated man an opaque black mouth covering. Both masks remain firmly on and opaque. No talking mouth animation, no camera motion, no cuts, no text. Start AND finish in the exact supplied resting pose, with one second of quiet breathing at both ends. ";
const prompts: {[K in NpcKind]:string} = {
  "idle-breathe": "Very subtle natural breathing and a single blink. The seated man keeps his arms folded, the witch calmly watches. No broad gestures. Return precisely to the starting pose.",
  "idle-glance": "The seated man briefly glances up at the witch with his eyes, then looks forward again. The witch gives one tiny head tilt then returns. Barely perceptible breathing. Return precisely to the starting pose.",
  "idle-shrug": "The seated man makes one tiny disgruntled shoulder adjustment while keeping arms folded, then relaxes. The witch blinks, barely moving. Return precisely to the starting pose.",
  "music-gift": "Comedic angry reaction. At 1 second the seated man uncrosses his arms and stands up in front of the chair. At 2 to 5 seconds he stands and gestures angrily at an annoying noise, with one open palm, frustrated raised eyebrows. At 5 seconds he lowers his hands and sits back down. By 7 seconds he has folded his arms and regained the EXACT starting seated pose. The witch remains in place watching amused. Both people stay fully in frame, masks and hats stay on.",
};
export function npcPayload(kind:NpcKind, image:string) {
  return {model:"veo3.1_fast",duration:8,ratio:"720:1280",audio:false,promptText:base+prompts[kind],promptImage:[{uri:image,position:"first"},{uri:image,position:"last"}]};
}
const voiceRecordId = (voiceId:string) => {const hash=digest(`npc-music-gift-v1:${voiceId}`);return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-8${hash.slice(17,20)}-${hash.slice(20,32)}`;};
export async function startNpcClip(store:Store, kind:NpcKind) {
  if(kind==="music-gift")return startNpcReaction(store);
  const id=ids[kind],old=await store.readRecord<Record>("live-backdrop",id);
  if(old)return old.value;
  if(!process.env.RUNWAYML_API_SECRET)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const budget=await getProductionBudget();
  if(!budget||(budget.configured_services.runway_npc_8s??0)<0.8)throw new AvatarError("NPC_BUDGET_NOT_CONFIGURED",409);
  const image=await readFile(path.join(process.cwd(),"public/live-studio/ali-isti-masked.webp"));
  if(kind==="idle-breathe"){const sha=digest(image);await store.putChunk(sha,0,image);await store.completeImage(sha,image.length);}
  const record:Record={status:"SUBMITTING",createdAt:new Date().toISOString()};
  if(!await store.writeRecord("live-backdrop",id,record))return (await store.readRecord<Record>("live-backdrop",id))!.value;
  const claim=await store.readRecord<Record>("live-backdrop",id);
  if(!claim)throw new AvatarError("NPC_UNCERTAIN",409);
  try {
    await reserveProductionBudget("runway_npc_8s");
    const response=await fetch("https://api.dev.runwayml.com/v1/image_to_video",{method:"POST",signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.RUNWAYML_API_SECRET}`,"X-Runway-Version":"2024-11-06","Content-Type":"application/json"},body:JSON.stringify(npcPayload(kind,`data:image/webp;base64,${image.toString("base64")}`))});
    if(!response.ok)throw new AvatarError("NPC_GENERATION_FAILED");
    const taskId=z.string().uuid().parse((await response.json()).id);
    const next:Record={...record,status:"PENDING",taskId};
    if(!await store.writeRecord("live-backdrop",id,next,claim.etag))throw new AvatarError("NPC_UNCERTAIN",409);
    return next;
  }catch(error){await store.writeRecord("live-backdrop",id,{...record,status:"UNCERTAIN"},claim.etag);throw error;}
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
  if(!saved.value.taskId||saved.value.status!=="PENDING")return {status:saved.value.status};
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
  return {clips,voice,ready:clips.every(c=>c.status==="SUCCEEDED")&&voice.status==="SUCCEEDED"};
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
