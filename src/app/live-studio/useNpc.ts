"use client";
import { useEffect, useRef, useState } from "react";
import { NPC_KINDS, type NpcManifest } from "@/lib/live/npc-shared";
export type NpcAssets={idle:string[];reaction:string;voice:string};
const wait=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  const cancel=()=>{clearTimeout(timer);reject(new DOMException("Stopped","AbortError"));};
  const timer=setTimeout(()=>{signal.removeEventListener("abort",cancel);resolve();},3000);
  signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();
});
export function useNpc(){
  const [assets,setAssets]=useState<NpcAssets>();
  const [status,setStatus]=useState("");
  const cache=useRef(new Map<string,string>());
  const saved=useRef<{voiceId:string;assets:NpcAssets}>();
  useEffect(()=>()=>{cache.current.forEach(url=>URL.revokeObjectURL(url));cache.current.clear();},[]);
  async function request(voiceId:string,signal:AbortSignal,kind?:string){
    const response=await fetch(`/api/live-studio/npc?voiceId=${encodeURIComponent(voiceId)}`,{signal,cache:"no-store",...(kind?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,voiceId})}:{})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error==="NPC_BUDGET_NOT_CONFIGURED"?"A jelenetkészítés költségkerete nincs beállítva.":`A mentett NPC-műsor nem érhető el (${data.error||response.status}). Újrapróbálás nem indít új generálást.`);
    return data as NpcManifest;
  }
  async function local(source:string,signal:AbortSignal){
    const old=cache.current.get(source);if(old)return old;
    const response=await fetch(source,{signal});
    if(!response.ok)throw new Error("A mentett jelenet letöltése megszakadt.");
    const blob=await response.blob();signal.throwIfAborted();
    if(blob.size<100)throw new Error("Üres jelenetfájl.");
    const url=URL.createObjectURL(blob);cache.current.set(source,url);return url;
  }
  async function ensure(voiceId:string,signal:AbortSignal,prepare=false){
    signal.throwIfAborted();if(saved.current?.voiceId===voiceId)return saved.current.assets;
    setStatus("Maszkolt NPC-jelenetek ellenőrzése…");
    try{
      let result=await request(voiceId,signal);
      if(prepare){
        for(const kind of NPC_KINDS){if(result.clips.find(c=>c.kind===kind)?.status==="MISSING"){
          setStatus(`Az egyszer elmentendő jelenet készül: ${NPC_KINDS.indexOf(kind)+1}/4`);await request(voiceId,signal,kind);
        }}
        if(result.voice.status==="MISSING"){setStatus("Isti kiabáló ajándékreakciójának mentése…");await request(voiceId,signal,"voice");}
      }else if(result.clips.some(c=>c.status==="MISSING")||result.voice.status==="MISSING")throw new Error("Előbb készítsd el a mentett NPC-jeleneteket. Az adásindítás nem generál fizetős videót.");
      const deadline=Date.now()+12*60_000;
      while(!result.ready){
        if([...result.clips,result.voice].some(c=>["FAILED","UNCERTAIN"].includes(c.status)))throw new Error("Egy jelenet készítése ellenőrzést igényel. Nem indult új fizetős próbálkozás.");
        if(Date.now()>deadline)throw new Error("A jelenetek még készülnek. Következő indításkor ugyanazokat ellenőrizzük.");
        setStatus(`Jelenetek készülnek: ${result.clips.filter(c=>c.status==="SUCCEEDED").length}/4. Újraindításkor sem készül másolat.`);
        await wait(signal);result=await request(voiceId,signal);
      }
      setStatus("A jelenetek és a reakcióhang előtöltése…");
      const clips=await Promise.all(result.clips.map(async c=>({kind:c.kind,url:await local(c.url!,signal)})));
      const next={idle:clips.filter(c=>c.kind!=="music-gift").map(c=>c.url),reaction:clips.find(c=>c.kind==="music-gift")!.url,voice:await local(result.voice.url!,signal)};
      signal.throwIfAborted();saved.current={voiceId,assets:next};setAssets(next);return next;
    }finally{setStatus("");}
  }
  return {assets,status,ensure};
}
