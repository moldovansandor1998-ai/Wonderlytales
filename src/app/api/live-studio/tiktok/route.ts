import { NextRequest } from "next/server";
import { experimental_upgradeWebSocket } from "@vercel/functions";
import { access, apiError, json } from "@/lib/ai-video/http";
import { serveTikTokSocket } from "@/lib/live/tiktok-cloud";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request:NextRequest) {
  try {
    const user = await access(request,true);
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return json({error:"WEBSOCKET_REQUIRED"},426);
    return await experimental_upgradeWebSocket(ws=>serveTikTokSocket(ws,user.id),{maxPayload:1024});
  } catch (error) {
    console.warn("live_tiktok_upgrade_failed",{code:error instanceof Error?error.constructor.name:"UnknownError"});
    return apiError(error);
  }
}
