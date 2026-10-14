"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { NpcAssets } from "./useNpc";
import type { MotionFrame } from "./useMotion";
import type { GagKind } from "@/lib/live/npc-shared";
export type NpcPlayback={react:(signal:AbortSignal,onStart:()=>Promise<void>,kind?:GagKind)=>Promise<void>};
const NpcPlayer=forwardRef<NpcPlayback,{assets:NpcAssets;active:boolean;onError?:(message:string)=>void;onFrame?:(frame:MotionFrame)=>void}>(function NpcPlayer({assets,active,onError,onFrame},ref){
  const a=useRef<HTMLVideoElement>(null),b=useRef<HTMLVideoElement>(null),gag=useRef<HTMLVideoElement>(null);
  const reacting=useRef(false),cancelReaction=useRef<()=>void>();
  const [visible,setVisible]=useState(0),[gagVisible,setGagVisible]=useState(false);
  const callbacks=useRef({onError,onFrame});callbacks.current={onError,onFrame};
  useImperativeHandle(ref,()=>({async react(signal,onStart,kind){
    signal.throwIfAborted();
    if(!active||reacting.current)throw new Error("A reakciójelenet még nem indítható.");
    const video=gag.current!,url=kind?assets.gags?.[kind]:assets.reaction;
    if(!url)throw new Error("Ez a rövid geg még nincs elmentve.");
    reacting.current=true;
    try {
      await new Promise<void>((resolve,reject)=>{
        let finished=false,started=false,timer:ReturnType<typeof setTimeout>;
        const done=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(watchdog);signal.removeEventListener("abort",cancel);video.onended=null;video.onerror=null;video.onplaying=null;video.onloadedmetadata=null;video.ontimeupdate=null;video.pause();video.removeAttribute("src");video.load();setGagVisible(false);error?reject(error):resolve();};
        const cancel=()=>done(new DOMException("Stopped","AbortError"));cancelReaction.current=cancel;
        const watchdog=setTimeout(()=>done(new Error("A rövid geg nem indult el.")),8000);
        signal.addEventListener("abort",cancel,{once:true});
        video.onloadedmetadata=()=>{video.playbackRate=kind?4/3:1.5;if(!kind)video.currentTime=Math.min(4,video.duration/3);};
        video.onplaying=()=>{if(started)return;started=true;setGagVisible(true);timer=setTimeout(()=>done(),3000);};
        video.ontimeupdate=()=>callbacks.current.onFrame?.({id:kind||"music-gift",url,position:video.currentTime,playing:!video.paused});
        video.onended=()=>done();video.onerror=()=>done(new Error("A rövid geg nem játszható le."));
        video.src=url;void video.play().catch(()=>done(new Error("A böngésző nem indította el a geget.")));
        if(signal.aborted)cancel();
      });
    } finally {reacting.current=false;cancelReaction.current=undefined;}
    // Kept for compatibility with saved-scene callers; normal gifts speak concurrently outside.
    signal.throwIfAborted();await onStart();
  }}),[active,assets]);
  useEffect(()=>{
    const players=[a.current!,b.current!];let disposed=false,current=0,last=-1,switching=false,lastFrame=0;
    let stagingTimer:ReturnType<typeof setTimeout>|undefined;
    const choose=()=>{const candidates=assets.idle.map((_,i)=>i).filter(i=>i!==last);last=candidates[Math.floor(Math.random()*candidates.length)]??0;return assets.idle[last];};
    const stage=(index:number,url:string)=>{players[index].src=url;players[index].load();};
    const publish=()=>{if(reacting.current)return;const v=players[current];callbacks.current.onFrame?.({id:"npc",url:v.src,position:v.currentTime,playing:active&&!v.paused});};
    const fail=()=>{if(!disposed)callbacks.current.onError?.("A mentett NPC-jelenet lejátszása megszakadt. Indítsd újra a műsort.");};
    const advance=async()=>{
      if(disposed||switching||!active)return;switching=true;
      const next=1-current;
      try{
        await players[next].play();if(disposed){players[next].pause();return;}
        const old=current;current=next;setVisible(current);publish();
        stagingTimer=setTimeout(()=>{if(disposed)return;players[old].pause();stage(old,choose());switching=false;},180);
      }catch{if(!disposed)fail();switching=false;}
    };
    const ended=()=>void advance();
    const tick=()=>{if(Date.now()-lastFrame>500){lastFrame=Date.now();publish();}};
    for(const v of players){v.muted=true;v.loop=false;v.addEventListener("ended",ended);v.addEventListener("error",fail);v.addEventListener("timeupdate",tick);}
    stage(0,choose());stage(1,choose());setVisible(0);
    if(active)void players[0].play().then(publish).catch(()=>{if(!disposed)fail();});
    const resume=()=>{if(!disposed&&active&&document.visibilityState==="visible")void players[current].play().catch(fail);};
    document.addEventListener("visibilitychange",resume);
    return()=>{disposed=true;clearTimeout(stagingTimer);cancelReaction.current?.();document.removeEventListener("visibilitychange",resume);for(const v of players){v.removeEventListener("ended",ended);v.removeEventListener("error",fail);v.removeEventListener("timeupdate",tick);v.pause();v.removeAttribute("src");v.load();}};
  },[assets,active]);
  return <>{[a,b].map((video,i)=><video key={i} ref={video} muted playsInline preload="auto" aria-label={i===visible?"Maszkolt NPC-jelenet":"Előtöltött következő jelenet"} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-150" style={{opacity:i===visible?1:0}} />)}<video ref={gag} muted playsInline preload="auto" aria-label="Rövid ajándékgeg" className="absolute inset-0 h-full w-full object-cover" style={{opacity:gagVisible?1:0}} /></>;
});
export default NpcPlayer;
