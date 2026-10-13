"use client";
import {useEffect, useRef, useState} from "react";
export type Clip = {requestId:string;createdAt:string;speaker?:"ali"|"isti";text?:string;url?:string;archived?:boolean;status?:string};
export default function MotionHistory({disabled,stopSignal,onStageReplay}:{disabled:boolean;stopSignal:number;onStageReplay?:(clip:Clip)=>void}) {
  const [clips,setClips]=useState<Clip[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const controller=useRef<AbortController|null>(null);
  const players=useRef(new Map<string,HTMLVideoElement>());
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(disabled)players.current.forEach(p=>p.pause());},[disabled]);
  useEffect(()=>{players.current.forEach(p=>p.pause());},[stopSignal]);
  async function load() {
    if(controller.current || disabled)return;
    const current=new AbortController();controller.current=current;setLoading(true);setError("");
    try {
      const response=await fetch("/api/live-studio/motion?recent=1",{cache:"no-store",signal:current.signal});
      if(!response.ok)throw new Error("A korábbi videók nem tölthetők be.");
      const data=await response.json() as {clips:Clip[]};
      const ready:Clip[]=[];
      for(let offset=0;offset<data.clips.length;offset+=3) {
        const batch=await Promise.all(data.clips.slice(offset,offset+3).map(async clip=>{
          try {
            const r=await fetch(`/api/live-studio/motion?requestId=${clip.requestId}`,{cache:"no-store",signal:current.signal});
            if(!r.ok)return {...clip,status:"Nem elérhető"};
            return {...clip,...await r.json()};
          }catch{return {...clip,status:"Nem elérhető"};}
        }));
        ready.push(...batch);
      }
      if(!current.signal.aborted)setClips(ready);
    }catch(e){if(!current.signal.aborted)setError(e instanceof Error?e.message:"Betöltési hiba.");}
    finally{if(controller.current===current)controller.current=null;if(!current.signal.aborted)setLoading(false);}
  }
  return <section className="space-y-3 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-5">
    <h2 className="text-xl font-semibold">Elkészült beszélő videók</h2>
    <p className="text-xs text-zinc-400">A legutóbbi 12 klip megnyitása és újrajátszása nem indít új hang- vagy videógenerálást. A mentett klipek a médiagaléria kész videói között is megmaradnak.</p>
    <button className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-40" disabled={disabled||loading} onClick={()=>void load()}>{loading?"Videók betöltése…":"Korábbi videók betöltése"}</button>
    {error && <p role="status">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{clips.map(clip=><article key={clip.requestId} className="space-y-2 rounded-lg bg-zinc-900 p-3">
      <h3 className="font-semibold">{clip.speaker==="ali"?"Ali":clip.speaker==="isti"?"Mc Isti":"Korábbi karakterpróba"}</h3>
      <p className="text-xs text-zinc-400">{new Date(clip.createdAt).toLocaleString("hu-HU")}</p>
      {clip.url && clip.status==="SUCCEEDED" ? <><video ref={node=>{if(node)players.current.set(clip.requestId,node);else players.current.delete(clip.requestId);}} src={clip.url} controls={!disabled} preload="metadata" playsInline className="aspect-video w-full rounded" onPlay={e=>{const current=e.currentTarget;if(disabled)current.pause();else players.current.forEach(p=>{if(p!==current)p.pause();});}} />{onStageReplay && <button className="rounded-lg border border-amber-400 px-3 py-2 text-sm text-amber-200 disabled:opacity-40" disabled={disabled} onClick={()=>{players.current.forEach(p=>p.pause());onStageReplay(clip);}}>Lejátszás a mobil adásképben</button>}{!clip.archived && <p className="text-amber-300 text-xs">A tartós mentés még nem sikerült; ez az ideiglenes szolgáltatói videó.</p>}</> : <p className="text-xs text-zinc-400">{clip.status==="FAILED"?"A videó készítése sikertelen volt.":clip.status==="PENDING"||clip.status==="RUNNING"||clip.status==="THROTTLED"?"A videó még készül.":"Ez a videó már nem érhető el."}</p>}
      {clip.text && <p className="text-sm">{clip.text}</p>}
    </article>)}</div>
    <a href="/ai-video/gallery" className="text-sm text-amber-300 underline">Médiagaléria</a>
  </section>;
}
