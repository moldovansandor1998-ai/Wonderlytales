"use client";
import { useEffect, useRef, useState } from "react";
import { NPC_KINDS, GAG_KINDS, GAG_META, type GagKind, type NpcManifest, type NpcOperation } from "@/lib/live/npc-shared";
export type NpcAssets={idle:string[];reaction:string;voice:string;begVoice?:string;gags?:Partial<Record<GagKind,string>>};
const wait=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
  const cancel=()=>{clearTimeout(timer);reject(new DOMException("Stopped","AbortError"));};
  const timer=setTimeout(()=>{signal.removeEventListener("abort",cancel);resolve();},3000);
  signal.addEventListener("abort",cancel,{once:true});if(signal.aborted)cancel();
});
export function useNpc(){
  const [assets,setAssets]=useState<NpcAssets>();
  const [status,setStatus]=useState("");
  const [manifest,setManifest]=useState<NpcManifest>();
  const cache=useRef(new Map<string,string>());
  const saved=useRef<{voiceId:string;assets:NpcAssets}>();
  useEffect(()=>()=>{cache.current.forEach(url=>URL.revokeObjectURL(url));cache.current.clear();},[]);
  async function request(voiceId:string,signal:AbortSignal,kind?:string,retry=false,action:NpcOperation="prepare"){
    const response=await fetch(`/api/live-studio/npc?voiceId=${encodeURIComponent(voiceId)}`,{signal,cache:"no-store",...(kind?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind,voiceId,retry,action})}:{})});
    const data=await response.json();
    if(!response.ok)throw new Error(`${kind&&kind in GAG_META?GAG_META[kind as GagKind].label+": ":""}`+(data.error==="NPC_BUDGET_NOT_CONFIGURED"?"A jelenetkészítés költségkerete nincs beállítva.":`A mentett NPC-műsor nem érhető el (${data.error||response.status}). Újrapróbálás nem indít új generálást.`));
    if(!kind)setManifest(data);
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
    signal.throwIfAborted();if(!prepare&&saved.current?.voiceId===voiceId)return saved.current.assets;
    setStatus("Maszkolt NPC-jelenetek ellenőrzése…");
    try{
      let result=await request(voiceId,signal);
      if(prepare){
        for(const kind of NPC_KINDS){if(result.clips.find(c=>c.kind===kind)?.status==="MISSING"){
          setStatus(`Az egyszer elmentendő jelenet készül: ${NPC_KINDS.indexOf(kind)+1}/${NPC_KINDS.length}`);await request(voiceId,signal,kind);
        }}
        if(result.voice.status==="MISSING"){setStatus("Isti kiabáló ajándékreakciójának mentése…");await request(voiceId,signal,"voice");}
        if(result.begVoice?.status==="MISSING")await request(voiceId,signal,"gag-beg",false,"prepare-beg");
      }else if(result.clips.some(c=>!c.kind.startsWith("gag-")&&c.status==="MISSING")||result.voice.status==="MISSING")throw new Error("Előbb készítsd el a mentett NPC-alapjeleneteket. Az adásindítás nem generál fizetős videót.");
      const deadline=Date.now()+12*60_000;
      while(!result.ready||(prepare&&result.clips.some(c=>GAG_KINDS.includes(c.kind as GagKind)&&c.status!=="SUCCEEDED"))){
        if([...result.clips.filter(c=>prepare||!c.kind.startsWith("gag-")),result.voice].some(c=>["FAILED","UNCERTAIN"].includes(c.status)))throw new Error("Egy jelenet készítése ellenőrzést igényel. Nem indult új fizetős próbálkozás.");
        if(Date.now()>deadline)throw new Error("A jelenetek még készülnek. Következő indításkor ugyanazokat ellenőrizzük.");
        setStatus(`Jelenetek készülnek: ${result.clips.filter(c=>c.status==="SUCCEEDED").length}/${NPC_KINDS.length}. Újraindításkor sem készül másolat.`);
        await wait(signal);result=await request(voiceId,signal);
      }
      setStatus("A jelenetek és a reakcióhang előtöltése…");
      const clips=await Promise.all(result.clips.filter(c=>c.status==="SUCCEEDED"&&c.url).map(async c=>({kind:c.kind,url:await local(c.url!,signal)})));
      const next={idle:clips.filter(c=>c.kind.startsWith("idle-")).map(c=>c.url),reaction:clips.find(c=>c.kind==="music-gift")!.url,voice:await local(result.voice.url!,signal),begVoice:result.begVoice?.status==="SUCCEEDED"&&result.begVoice.url?await local(result.begVoice.url,signal):undefined,gags:Object.fromEntries(clips.filter(c=>c.kind.startsWith("gag-")).map(c=>[c.kind,c.url]))};
      signal.throwIfAborted();saved.current={voiceId,assets:next};setAssets(next);return next;
    }finally{setStatus("");}
  }
  async function inspect(voiceId:string,signal:AbortSignal){return request(voiceId,signal);}
  async function retryClip(voiceId:string,kind:GagKind,signal:AbortSignal){
    try{await request(voiceId,signal,kind,true);}
    finally{if(!signal.aborted)await request(voiceId,signal);}
  }
  async function recoverClip(voiceId:string,kind:GagKind,signal:AbortSignal,action:NpcOperation){
    try{await request(voiceId,signal,kind,false,action);}
    finally{saved.current=undefined;if(!signal.aborted)await request(voiceId,signal);}
  }
  return {assets,status,ensure,manifest,inspect,retryClip,recoverClip};
}
