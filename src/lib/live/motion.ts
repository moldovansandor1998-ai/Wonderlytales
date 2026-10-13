import { z } from "zod";
import { reserveProductionBudget } from "@/lib/budget";
import { AvatarError } from "./avatar";

export const motionInput = z.object({ requestId:z.string().uuid(), speaker:z.enum(["ali","isti"]), text:z.string().trim().min(1).max(220), voiceId:z.string().regex(/^[a-zA-Z0-9]{1,100}$/) }).strict();
export const motionId = motionInput.pick({requestId:true});
export type MotionRecord = { requestId:string; createdAt:string; state:"creating"|"active"|"cancel_requested"|"ended"; taskId?:string };
export function motionConfiguration() {
  return { configured:!!(process.env.RUNWAYML_API_SECRET && process.env.ELEVENLABS_API_KEY && process.env.RUNWAY_AVATAR_ID && process.env.RUNWAY_ALI_AVATAR_ID) };
}
async function runway(path:string, method="GET", body?:unknown) {
  const key=process.env.RUNWAYML_API_SECRET;
  if(!key)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const r=await fetch(`https://api.dev.runwayml.com/v1/${path}`,{method,cache:"no-store",signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${key}`,"X-Runway-Version":"2024-11-06","Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(method==="DELETE" && r.status===404)return null;
  if(!r.ok)throw new AvatarError(r.status===401?"RUNWAY_ACCESS_DENIED":r.status===402?"RUNWAY_CREDITS_REQUIRED":r.status===429?"RUNWAY_RATE_LIMIT":"RUNWAY_REQUEST_FAILED");
  return method==="DELETE"||r.status===204?null:r.json();
}
export async function prepareMotion(speaker:"ali"|"isti") {
  if(!process.env.ELEVENLABS_API_KEY)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const avatarId=z.string().uuid().safeParse(speaker==="ali"?process.env.RUNWAY_ALI_AVATAR_ID:process.env.RUNWAY_AVATAR_ID);
  if(!avatarId.success)throw new AvatarError("MOTION_NOT_CONFIGURED");
  const data=await runway(`avatars/${avatarId.data}`);
  if(data?.status!=="READY")throw new AvatarError("RUNWAY_CHARACTER_NOT_READY");
  return avatarId.data;
}
/** Exact PCM sample count bounds the video to 30s before the paid Runway call. */
export function pcmWave(audio:string) {
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(audio))throw new AvatarError("VOICE_PROVIDER_ERROR");
  const pcm=Buffer.from(audio,"base64");
  if(pcm.length<3200||pcm.length%2||pcm.length>30*16000*2)throw new AvatarError("MOTION_AUDIO_TOO_LONG");
  const header=Buffer.alloc(44);
  header.write("RIFF",0);header.writeUInt32LE(36+pcm.length,4);header.write("WAVEfmt ",8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(16000,24);header.writeUInt32LE(32000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write("data",36);header.writeUInt32LE(pcm.length,40);
  return Buffer.concat([header,pcm]);
}
export async function motionSpeech(input:z.infer<typeof motionInput>) {
  await reserveProductionBudget("tts");
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}/with-timestamps?output_format=pcm_16000`,{method:"POST",headers:{"xi-api-key":process.env.ELEVENLABS_API_KEY!,"Content-Type":"application/json"},body:JSON.stringify({text:input.text,model_id:"eleven_flash_v2_5",language_code:"hu",voice_settings:{stability:input.speaker==="isti"?0.3:0.45,similarity_boost:0.75,use_speaker_boost:true}}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new AvatarError("VOICE_PROVIDER_ERROR");
  const data=await r.json();
  if(typeof data.audio_base64!=="string"||data.audio_base64.length>1300000)throw new AvatarError("VOICE_PROVIDER_ERROR");
  return pcmWave(data.audio_base64);
}
export async function createMotion(avatarId:string,wave:Buffer) {
  // Official price: 2 credits + 2/6s. A <=30s clip reserves 12 credits ($0.12).
  await reserveProductionBudget("runway_reply_30s");
  const data=await runway("avatar_videos","POST",{model:"gwm1_avatars",avatar:{type:"custom",avatarId},speech:{type:"audio",audio:`data:audio/wav;base64,${wave.toString("base64")}`}});
  return z.string().uuid().parse(data?.id);
}
export async function retrieveMotion(taskId:string) {
  z.string().uuid().parse(taskId);
  const data=await runway(`tasks/${taskId}`);
  const status=z.enum(["PENDING","THROTTLED","RUNNING","SUCCEEDED","FAILED","CANCELLED"]).parse(data?.status);
  if(status==="SUCCEEDED") {
    const url=z.string().url().parse(data.output?.[0]);
    if(new URL(url).protocol!=="https:")throw new AvatarError("MOTION_INVALID_VIDEO");
    return {status,url};
  }
  return {status};
}
export async function cancelMotion(taskId:string) { z.string().uuid().parse(taskId);await runway(`tasks/${taskId}`,"DELETE"); }
