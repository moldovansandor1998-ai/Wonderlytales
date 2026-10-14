import type { WebSocket } from "ws";
import { eventSchema } from "./events";
import { normalizeEvent } from "../../../tools/tiktok-bridge/normalize.mjs";
import { claimTikTokSession } from "./tiktok-session";
import { tikTokFailure } from "./tiktok-error";

/** No TikTok credentials are accepted or forwarded: only public LIVE events. */
export async function serveTikTokSocket(ws:WebSocket, ownerId:string) {
  return new Promise<void>(resolve => {
    const counts = { comment:0, gift:0, follow:0 };
    let finished = false, started = false, release:(()=>Promise<void>)|null = null;
    let connection:import("tiktok-live-connector").TikTokLiveConnection|null = null;
    let upstreamReady = false;
    let connectTimer:ReturnType<typeof setTimeout>|undefined;
    const send = (value:unknown) => { if (!finished && ws.readyState === 1) ws.send(JSON.stringify(value)); };
    const status = (connected:boolean,message:string,terminal=false,code?:string) => send({type:"status",connected,message,terminal,code});
    const finish = () => {
      if (finished) return;
      finished = true; clearTimeout(authTimer); clearTimeout(lifetime); clearTimeout(connectTimer); clearInterval(heartbeat);
      if (upstreamReady) console.info("live_tiktok_session_closed", { counts });
      void Promise.allSettled([connection?.disconnect(), release?.()]).finally(resolve);
    };
    const stop = (code:number, message:string) => { ws.close(code,message); finish(); };
    const fail = (message:string,code?:string) => { status(false,message,true,code); stop(1000,"Stopped"); };
    const report = (error:unknown) => {
      const detail=tikTokFailure(error);
      console.warn("live_tiktok_connect_failed",{code:detail.code,signerConfigured:!!process.env.EULER_STREAM_API_KEY});
      return detail;
    };
    const authTimer = setTimeout(()=>stop(1008,"Connection message required"),10000);
    const lifetime = setTimeout(()=>{status(false,"A szerverkapcsolat megújítása…");stop(1012,"Renew connection");},250000);
    const heartbeat = setInterval(()=>{if(ws.readyState===1)ws.ping();},20000);
    ws.on("close",finish); ws.on("error",finish);
    ws.on("message",async raw => {
      if (started || finished) return;
      started = true; clearTimeout(authTimer);
      try {
        if (raw.toString().length > 1000) { stop(1008,"Invalid input"); return; }
        const input = JSON.parse(raw.toString());
        if (input.type === "probe") {
          send({type:"probe",ok:true,message:"A telefonos szerverkapcsolat működik. Az élő TikTok-kommenteket még külön kell kipróbálni."});
          stop(1000,"Probe complete"); return;
        }
        if (input.type !== "connect" || typeof input.username !== "string" || !/^[a-zA-Z0-9_.]{2,32}$/.test(input.username)) {stop(1008,"Invalid username");return;}
        release = await claimTikTokSession(ownerId);
        if (finished) { await release?.(); return; }
        if (!release) { fail("Már fut kommentkapcsolat, vagy túl gyors az újracsatlakozás. Bontsd a másik kapcsolatot; várj néhány másodpercet.","TIKTOK_SESSION_BUSY"); return; }
        status(false,"TikTok-adás keresése…");
        connectTimer = setTimeout(()=>fail("A TikTok-kapcsolat nem épült fel időben. Ellenőrizd a felhasználónevet és az aktív LIVE-adást.","TIKTOK_TIMEOUT"),25000);
        const [{TikTokLiveConnection, WebcastEvent, ControlEvent}, {ControlAction}] = await Promise.all([
          import("tiktok-live-connector"), import("tiktok-live-proto/v3"),
        ]);
        if (finished) return;
        // Native gift events include names. An optional gift-catalog request must not block connecting.
        connection = new TikTokLiveConnection(input.username,{processInitialData:false,enableExtendedGiftInfo:false,
          ...(process.env.EULER_STREAM_API_KEY ? {signApiKey:process.env.EULER_STREAM_API_KEY} : {}),
          wsClientOptions:{handshakeTimeout:10000}
        });
        const forward = (type:"comment"|"gift"|"follow",data:unknown) => {
          if (finished || ws.bufferedAmount > 65536) return;
          const event = normalizeEvent(type,data);
          const parsed = eventSchema.safeParse(event);
          if (parsed.success) {
            counts[type]++;
            if (counts[type] === 1) console.info("live_tiktok_first_event", { type });
            send({type:"event",event:parsed.data});
          } else if (event) console.warn("live_tiktok_invalid_event", { type });
        };
        connection.on(WebcastEvent.CHAT,data=>forward("comment",data));
        connection.on(WebcastEvent.GIFT,data=>forward("gift",data));
        connection.on(WebcastEvent.FOLLOW,data=>forward("follow",data));
        connection.on(WebcastEvent.CONTROL_MESSAGE, data => {
          if (data.action === ControlAction.CONTROL_ACTION_STREAM_PAUSED) {
            console.info("live_tiktok_paused");
            status(true,"A TikTok-adás szünetel. A kommentfigyelő várja a folytatást.");
          } else if (data.action === ControlAction.CONTROL_ACTION_STREAM_UNPAUSED) {
            console.info("live_tiktok_resumed");
            status(true,`@${input.username} – az adás folytatódott, kommentek és ajándékok csatlakoztatva`);
          }
        });
        connection.on(WebcastEvent.STREAM_END, data => {
          // The SDK emits streamEnd AND disconnects for suspension as well as actual end.
          if (data?.action === ControlAction.CONTROL_ACTION_STREAM_SUSPENDED) {
            console.info("live_tiktok_suspended");
            status(false,"A TikTok-adás átmenetileg szünetel. A kapcsolatot automatikusan helyreállítjuk.",false,"TIKTOK_SUSPENDED");
            stop(1012,"Stream suspended");
          } else {
            console.info("live_tiktok_ended");
            fail("A TikTok-adás véget ért. A kommentfigyelő megállt.","TIKTOK_ENDED");
          }
        });
        connection.on(ControlEvent.DISCONNECTED,()=>{if(!finished&&upstreamReady){status(false,"A TikTok-kapcsolat helyreállítása… Az alapvideó tovább fut.");stop(1012,"Upstream disconnected");}});
        // The SDK emits ERROR before rejecting connect(), and also for individual undecodable messages.
        // Await connect() for its actual reason; message decoding errors must not tear down a healthy socket.
        connection.on(ControlEvent.ERROR,error=>{if(!finished&&upstreamReady)report(error);});
        await connection.connect();
        clearTimeout(connectTimer);
        if (finished) { await connection.disconnect(); return; }
        upstreamReady = true;
        console.info("live_tiktok_connected");
        status(true,`@${input.username} – kommentek és ajándékok csatlakoztatva`);
      } catch (error) {
        if (finished) return;
        const detail=report(error);
        fail(detail.message,detail.code);
      }
    });
  });
}
