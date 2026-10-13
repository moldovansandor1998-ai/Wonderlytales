import { NextRequest } from "next/server";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { R2VideoStore } from "@/lib/ai-video/storage";
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
    const record:MotionRecord={requestId:input.requestId,state:"creating",createdAt:new Date().toISOString()};
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
    const {requestId}=motionId.parse({requestId:request.nextUrl.searchParams.get("requestId")});
    const record=await new R2VideoStore(user.id).readRecord<MotionRecord>("live-motion",requestId);
    if(!record)throw new AvatarError("MOTION_NOT_FOUND",404);
    if(record.value.state==="cancel_requested"||record.value.state==="ended")return json({status:"CANCELLED"});
    return json(record.value.taskId?await retrieveMotion(record.value.taskId):{status:"PENDING"});
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
