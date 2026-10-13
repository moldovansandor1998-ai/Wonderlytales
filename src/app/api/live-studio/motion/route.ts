import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { R2VideoStore, digest } from "@/lib/ai-video/storage";
import { downloadProviderMedia } from "@/lib/ai-video/media";
import { AvatarError } from "@/lib/live/avatar";
import { motionId, motionInput, prepareMotion, motionSpeech, createMotion, retrieveMotion, cancelMotion, type MotionRecord } from "@/lib/live/motion";
export const runtime="nodejs";
export const maxDuration=120;
const failure=(e:unknown)=>e instanceof AvatarError?json({error:e.code},e.status):apiError(e);
export async function POST(request:NextRequest) {
  let taskId:string|undefined;
  try {
    const user=await access(request,true);
    const input=motionInput.parse(await readJson(request));
    const store=new R2VideoStore(user.id);
    const record:MotionRecord={requestId:input.requestId,state:"creating",createdAt:new Date().toISOString(),speaker:input.speaker,text:input.text};
    if(!await store.writeRecord("live-motion",input.requestId,record))throw new AvatarError("MOTION_REQUEST_ALREADY_USED",409);
    const avatarId=await prepareMotion(input.speaker);
    const wave=await motionSpeech(input);
    const before=await store.readRecord<MotionRecord>("live-motion",input.requestId);
    if(before?.value.state!=="creating")throw new AvatarError("MOTION_CANCELLED",409);
    taskId=await createMotion(avatarId,wave);
    const current=await store.readRecord<MotionRecord>("live-motion",input.requestId);
    if(current?.value.state!=="creating"||!await store.writeRecord("live-motion",input.requestId,{...record,taskId,state:"active"},current.etag))throw new AvatarError("MOTION_CANCELLED",409);
    return json({requestId:input.requestId});
  } catch(e) {
    if(taskId) {try{await cancelMotion(taskId);}catch{return json({error:"MOTION_CLEANUP_PENDING"},503);}}
    return failure(e);
  }
}
export async function GET(request:NextRequest) {
  try {
    const user=await access(request);
    const store=new R2VideoStore(user.id);
    if(request.nextUrl.searchParams.get("recent")==="1") {
      const records=await store.listRecords<MotionRecord>("live-motion");
      return json({clips:records.filter(r=>r.state==="active" && r.taskId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12).map(r=>({requestId:r.requestId,createdAt:r.createdAt,speaker:r.speaker,text:r.text}))});
    }
    const {requestId}=motionId.parse({requestId:request.nextUrl.searchParams.get("requestId")});
    const record=await store.readRecord<MotionRecord>("live-motion",requestId);
    if(!record)throw new AvatarError("MOTION_NOT_FOUND",404);
    if(record.value.state==="cancel_requested"||record.value.state==="ended")return json({status:"CANCELLED"});
    if(record.value.assetId)return json({status:"SUCCEEDED",url:`/api/ai-video/assets/${record.value.assetId}`,archived:true});
    const result=record.value.taskId?await retrieveMotion(record.value.taskId):{status:"PENDING"};
    if(result.status!=="SUCCEEDED" || !("url" in result) || !result.url)return json(result);
    try {
      const bytes=await downloadProviderMedia(result.url,100*1024*1024);
      if(bytes.length<100 || bytes.toString("ascii",4,8)!=="ftyp")throw new Error("INVALID_VIDEO");
      const assetId=digest(bytes);
      await store.putAsset(assetId,"mp4",bytes);
      const current=await store.readRecord<MotionRecord>("live-motion",requestId);
      if(!current || current.value.state!=="active")return json({status:"CANCELLED"});
      await store.writeRecord("live-motion",requestId,{...current.value,assetId},current.etag);
      return json({status:"SUCCEEDED",url:`/api/ai-video/assets/${assetId}`,archived:true});
    }catch{
      // Playback can continue from the provider. Reopening history retries only
      // the file transfer, never ElevenLabs or Runway generation.
      return json({...result,archived:false});
    }
  }catch(e){return failure(e);}
}
export async function DELETE(request:NextRequest) {
  try {
    const user=await access(request,true);
    const {requestId}=motionId.parse(await readJson(request));
    const store=new R2VideoStore(user.id);
    const record=await store.readRecord<MotionRecord>("live-motion",requestId);
    if(!record) {
      if(!await store.writeRecord("live-motion",requestId,{requestId,state:"cancel_requested",createdAt:new Date().toISOString()}))throw new AvatarError("MOTION_STOP_RETRY",409);
      return json({stopped:true});
    }
    if(record.value.state==="ended")return json({stopped:true});
    if(record.value.taskId)await cancelMotion(record.value.taskId);
    if(!await store.writeRecord("live-motion",requestId,{...record.value,state:record.value.taskId?"ended":"cancel_requested"},record.etag))throw new AvatarError("MOTION_STOP_RETRY",409);
    return json({stopped:true});
  }catch(e){return failure(e);}
}
