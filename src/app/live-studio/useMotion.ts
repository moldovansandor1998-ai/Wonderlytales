"use client";
import { useRef, useState } from "react";
import type { DialogueTurn } from "@/lib/live/duo";
export type MotionFrame={id:string;url:string;position:number;playing:boolean};
const errors:Record<string,string>={MOTION_NOT_CONFIGURED:"A két Runway-karakter még nincs bekötve.",RUNWAY_CHARACTER_NOT_READY:"A Runway-karakter még feldolgozás alatt áll.",RUNWAY_CREDITS_REQUIRED:"A Runway API-egyenlegen nincs elegendő kredit.",RUNWAY_ACCESS_DENIED:"A Runway nem fogadta el az API-hozzáférést.",RUNWAY_RATE_LIMIT:"A Runway átmeneti híváskorlátot jelzett.",MOTION_AUDIO_TOO_LONG:"A válasz hangja túllépi a 30 másodperces videókorlátot.",VOICE_PROVIDER_ERROR:"Az ElevenLabs nem készítette el a videó hangját."};
async function read(r:Response) {const data=await r.json();if(!r.ok)throw new Error(errors[data.error]||"A beszélő videó nem készült el. A sor megállt; nincs automatikus fizetős újrapróbálás.");return data;}
function delay(ms:number,signal:AbortSignal) {return new Promise<void>((resolve,reject)=>{const cancel=()=>{clearTimeout(timer);reject(new DOMException("Stopped","AbortError"));};const timer=setTimeout(()=>{signal.removeEventListener("abort",cancel);resolve();},ms);signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();});}
export function useMotion() {
  const element=useRef<HTMLVideoElement>(null);
  const [frame,setFrame]=useState<MotionFrame>();
  const [speaking,setSpeaking]=useState(false);
  const [status,setStatus]=useState("");
  async function play(url:string,requestId:string,signal:AbortSignal,onStart?:()=>void) {
    signal.throwIfAborted();
      const player=element.current;if(!player)throw new Error("A videólejátszó nem elérhető.");
      await new Promise<void>((resolve,reject)=>{
        let finished=false,started=false;
        const done=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);signal.removeEventListener("abort",cancel);player.onplaying=null;player.onpause=null;player.onended=null;player.onerror=null;player.ontimeupdate=null;player.pause();player.removeAttribute("src");player.load();setSpeaking(false);setFrame(undefined);error?reject(error):resolve();};
        const cancel=()=>done(new DOMException("Stopped","AbortError"));
        const timer=setTimeout(()=>done(new Error("A videólejátszás megakadt; a sor megállt.")),60000);
        signal.addEventListener("abort",cancel,{once:true});
        const publish=()=>setFrame({id:requestId,url,position:player.currentTime,playing:!player.paused});
        player.onplaying=()=>{setSpeaking(true);publish();if(!started){started=true;onStart?.();}};
        player.onpause=()=>{setSpeaking(false);publish();};player.ontimeupdate=publish;
        player.onended=()=>done();player.onerror=()=>done(new Error("A Runway-videó nem játszható le."));
        player.src=url;void player.play().catch(()=>done(new Error("A böngésző letiltotta a videó hangját. Engedélyezd a webhely automatikus hangját.")));
      });
  }
  async function say(turn:DialogueTurn,voiceId:string,signal:AbortSignal,onStart?:()=>void) {
    signal.throwIfAborted();
    const requestId=crypto.randomUUID();let complete=false;
    const stop=()=>{void fetch("/api/live-studio/motion",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId}),keepalive:true}).then(r=>{if(!r.ok)setStatus("A leállítás visszaigazolása hiányzik. Új videót ne indíts a feladat ellenőrzéséig.");}).catch(()=>setStatus("A Runway-leállítás nem igazolható; a legfeljebb 30 másodperces feladat még befejeződhet."));};
    try {
      setStatus(`${turn.speaker==="ali"?"Ali":"Mc Isti"} beszélő videója készül…`);
      await read(await fetch("/api/live-studio/motion",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,speaker:turn.speaker,text:turn.text,voiceId}),signal}));
      let url="";const deadline=Date.now()+180000;
      while(Date.now()<deadline) {
        signal.throwIfAborted();
        const data=await read(await fetch(`/api/live-studio/motion?requestId=${requestId}`,{signal,cache:"no-store"}));
        if(data.status==="SUCCEEDED"){url=data.url;complete=true;break;}
        if(data.status==="FAILED"||data.status==="CANCELLED")throw new Error("A Runway nem fejezte be a videót. A sor megállt.");
        await delay(2500,signal);
      }
      if(!url)throw new Error("A videó nem készült el három percen belül. A sor megállt.");
      signal.throwIfAborted();setStatus("Videó lejátszása");
      await play(url, requestId, signal, onStart);
      setStatus("");
    }finally{if(!complete)stop();setSpeaking(false);setFrame(undefined);if(signal.aborted)setStatus("Videós válasz leállítva.");}
  }
  return {element,frame,speaking,status,say,play};
}
