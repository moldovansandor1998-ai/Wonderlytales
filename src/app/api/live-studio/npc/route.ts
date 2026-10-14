import { NextRequest } from "next/server";
import { z } from "zod";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { R2VideoStore } from "@/lib/ai-video/storage";
import { AvatarError } from "@/lib/live/avatar";
import { NPC_KINDS } from "@/lib/live/npc-shared";
import { readNpc, startNpcClip, startNpcVoice, activateNpcGalaxy } from "@/lib/live/npc";
export const runtime="nodejs";
export const maxDuration=120;
const voice=z.string().regex(/^[a-zA-Z0-9]{1,100}$/);
const failure=(e:unknown)=>e instanceof AvatarError?json({error:e.code},e.status):apiError(e);
export async function GET(request:NextRequest){try{
  const user=await access(request);return json(await readNpc(new R2VideoStore(user.id),voice.parse(request.nextUrl.searchParams.get("voiceId"))));
}catch(e){return failure(e);}}
export async function POST(request:NextRequest){try{
  const user=await access(request,true);
  const input=z.object({kind:z.enum([...NPC_KINDS,"voice"]),voiceId:voice,retry:z.boolean().default(false),action:z.enum(["prepare","recover-credit","revise-galaxy","activate-galaxy","prepare-beg"]).default("prepare")}).strict().refine(input=>input.action==="prepare"||(!input.retry&&(input.action==="prepare-beg"?input.kind==="gag-beg":input.action==="recover-credit"?input.kind.startsWith("gag-"):input.kind==="gag-galaxy"))).parse(await readJson(request));
  const store=new R2VideoStore(user.id);
  if(input.action==="prepare-beg"){
    const clip=await startNpcClip(store,"gag-beg");
    if(["PENDING","SUCCEEDED"].includes(clip.status))await startNpcVoice(store,input.voiceId,"beg");
    return json({status:clip.status});
  }
  const result=input.action==="activate-galaxy"?await activateNpcGalaxy(store):input.kind==="voice"?await startNpcVoice(store,input.voiceId):await startNpcClip(store,input.kind,input.retry,{recoverCredit:input.action==="recover-credit",galaxyRevision:input.action==="revise-galaxy"});
  return json({status:result.status});
}catch(e){return failure(e);}}
