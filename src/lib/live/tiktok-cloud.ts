import type { WebSocket } from "ws";
import { eventSchema } from "./events";
import { normalizeEvent } from "../../../tools/tiktok-bridge/normalize.mjs";
import { claimTikTokSession } from "./tiktok-session";

/** No TikTok credentials are accepted or forwarded: only public LIVE events. */
export async function serveTikTokSocket(ws:WebSocket, ownerId:string) {
  return new Promise<void>(resolve => {
    let finished = false, started = false, release:(()=>Promise<void>)|null = null;
    let connection:import("tiktok-live-connector").TikTokLiveConnection|null = null;
    let connectTimer:ReturnType<typeof setTimeout>|undefined;
    const send = (value:unknown) => { if (!finished && ws.readyState === 1) ws.send(JSON.stringify(value)); };
    const status = (connected:boolean,message:string,terminal=false) => send({type:"status",connected,message,terminal});
    const finish = () => {
      if (finished) return;
      finished = true; clearTimeout(authTimer); clearTimeout(lifetime); clearTimeout(connectTimer); clearInterval(heartbeat);
      void Promise.allSettled([connection?.disconnect(), release?.()]).finally(resolve);
    };
    const stop = (code:number, message:string) => { ws.close(code,message); finish(); };
    const fail = (message:string) => { status(false,message,true); stop(1000,"Stopped"); };
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
        if (!release) { fail("Már fut kommentkapcsolat, vagy túl gyors az újracsatlakozás. Bontsd a másik kapcsolatot; várj néhány másodpercet."); return; }
        status(false,"TikTok-adás keresése…");
        connectTimer = setTimeout(()=>fail("A TikTok-kapcsolat nem épült fel időben. Ellenőrizd a felhasználónevet és az aktív LIVE-adást."),25000);
        const {TikTokLiveConnection, WebcastEvent, ControlEvent} = await import("tiktok-live-connector");
        if (finished) return;
        connection = new TikTokLiveConnection(input.username,{processInitialData:false,enableExtendedGiftInfo:true,
          ...(process.env.EULER_STREAM_API_KEY ? {signApiKey:process.env.EULER_STREAM_API_KEY} : {}),
          wsClientOptions:{handshakeTimeout:10000}
        });
        const forward = (type:"comment"|"gift"|"follow",data:unknown) => {
          if (finished || ws.bufferedAmount > 65536) return;
          const event = normalizeEvent(type,data);
          const parsed = eventSchema.safeParse(event);
          if (parsed.success) send({type:"event",event:parsed.data});
        };
        connection.on(WebcastEvent.CHAT,data=>forward("comment",data));
        connection.on(WebcastEvent.GIFT,data=>forward("gift",data));
        connection.on(WebcastEvent.FOLLOW,data=>forward("follow",data));
        connection.on(WebcastEvent.STREAM_END,()=>fail("A TikTok-adás véget ért. A kommentfigyelő megállt."));
        connection.on(ControlEvent.DISCONNECTED,()=>{if(!finished)fail("Megszakadt a TikTok-kapcsolat. Ellenőrizd az adást, majd csatlakozz újra.");});
        connection.on(ControlEvent.ERROR,()=>{if(!finished)fail("A TikTok vagy a kapcsolatszolgáltató hibát jelzett. Nincs automatikus újrapróbálás.");});
        await connection.connect();
        clearTimeout(connectTimer);
        if (finished) { await connection.disconnect(); return; }
        status(true,`@${input.username} – kommentek és ajándékok csatlakoztatva`);
      } catch (error) {
        if (finished) return;
        console.warn("live_tiktok_connect_failed",{code:error instanceof Error?error.constructor.name:"UnknownError"});
        fail("Nem sikerült kapcsolódni a TikTokhoz. A fiók legyen élő adásban; szolgáltatói korlátozás is akadályozhatja a kapcsolatot.");
      }
    });
  });
}
