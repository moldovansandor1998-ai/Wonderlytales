"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { NpcAssets } from "./useNpc";
import type { MotionFrame } from "./useMotion";
export type NpcPlayback={react:(signal:AbortSignal,onStart:()=>Promise<void>)=>Promise<void>};
type Pending={signal:AbortSignal;start:()=>Promise<void>;resolve:()=>void;reject:(e:Error)=>void;cancel:()=>void;started:boolean;audio?:Promise<void>;timer:ReturnType<typeof setTimeout>};
const NpcPlayer=forwardRef<NpcPlayback,{assets:NpcAssets;active:boolean;onError?:(message:string)=>void;onFrame?:(frame:MotionFrame)=>void}>(function NpcPlayer({assets,active,onError,onFrame},ref){
  const a=useRef<HTMLVideoElement>(null),b=useRef<HTMLVideoElement>(null);
  const pending=useRef<Pending>();
  const [visible,setVisible]=useState(0);
  const callbacks=useRef({onError,onFrame});callbacks.current={onError,onFrame};
  useImperativeHandle(ref,()=>({react(signal,onStart){
    signal.throwIfAborted();
    if(!active||pending.current)return Promise.reject(new Error("A reakciójelenet még nem indítható."));
    return new Promise<void>((resolve,reject)=>{
      const finish=(error?:Error)=>{const p=pending.current;if(!p)return;clearTimeout(p.timer);signal.removeEventListener("abort",p.cancel);pending.current=undefined;error?reject(error):resolve();};
      const cancel=()=>finish(new DOMException("Stopped","AbortError"));
      pending.current={signal,start:onStart,resolve:()=>finish(),reject:finish,cancel,started:false,timer:setTimeout(()=>finish(new Error("Az ajándékreakció lejátszása megszakadt.")),35000)};
      signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();
    });
  }}),[active]);
  useEffect(()=>{
    const players=[a.current!,b.current!];let disposed=false,current=0,last=-1,switching=false,reaction=false,lastFrame=0;
    let stagingTimer:ReturnType<typeof setTimeout>|undefined;
    const choose=()=>{const candidates=assets.idle.map((_,i)=>i).filter(i=>i!==last);last=candidates[Math.floor(Math.random()*candidates.length)]??0;return assets.idle[last];};
    let prepared=choose();
    const stage=(index:number,url:string)=>{players[index].src=url;players[index].load();};
    const publish=()=>{const v=players[current];callbacks.current.onFrame?.({id:"npc",url:v.src,position:v.currentTime,playing:active&&!v.paused});};
    const fail=()=>{if(disposed)return;pending.current?.reject(new Error("A mentett NPC-jelenet lejátszása megszakadt."));callbacks.current.onError?.("A mentett NPC-jelenet lejátszása megszakadt. Indítsd újra a műsort.");};
    const advance=async()=>{
      if(disposed||switching||!active)return;switching=true;
      const p=pending.current;
      if(reaction&&p?.started){await p.audio; if(disposed)return;p.resolve();}
      const next=1-current;
      const requested=pending.current&&!pending.current.started?pending.current:undefined;
      if(requested){prepared=assets.reaction;stage(next,prepared);}
      try{
        await players[next].play();if(disposed){players[next].pause();return;}
        const old=current;current=next;reaction=!!requested;setVisible(current);publish();
        if(requested){requested.started=true;requested.audio=requested.start().catch(error=>{requested.reject(error);callbacks.current.onError?.(error instanceof Error?error.message:"Hanghiba");});}
        stagingTimer=setTimeout(()=>{if(disposed)return;players[old].pause();prepared=choose();stage(old,prepared);switching=false;},180);
      }catch{if(!disposed)fail();switching=false;}
    };
    const ended=()=>void advance();
    const tick=()=>{if(Date.now()-lastFrame>500){lastFrame=Date.now();publish();}};
    for(const v of players){v.muted=true;v.loop=false;v.addEventListener("ended",ended);v.addEventListener("error",fail);v.addEventListener("timeupdate",tick);}
    stage(0,prepared);prepared=choose();stage(1,prepared);setVisible(0);
    if(active)void players[0].play().then(publish).catch(()=>{if(!disposed)fail();});
    const resume=()=>{if(!disposed&&active&&document.visibilityState==="visible")void players[current].play().catch(fail);};
    document.addEventListener("visibilitychange",resume);
    return()=>{disposed=true;clearTimeout(stagingTimer);pending.current?.cancel();document.removeEventListener("visibilitychange",resume);for(const v of players){v.removeEventListener("ended",ended);v.removeEventListener("error",fail);v.removeEventListener("timeupdate",tick);v.pause();v.removeAttribute("src");v.load();}};
  },[assets,active]);
  return <>{[a,b].map((video,i)=><video key={i} ref={video} muted playsInline preload="auto" aria-label={i===visible?"Maszkolt NPC-jelenet":"Előtöltött következő jelenet"} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-150" style={{opacity:i===visible?1:0}} />)}</>;
});
export default NpcPlayer;
