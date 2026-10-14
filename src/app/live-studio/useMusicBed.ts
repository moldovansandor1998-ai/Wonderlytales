"use client";
import { useEffect, useRef, useState } from "react";
import { MusicBed } from "@/lib/live/music-bed";
import type { DjMood } from "@/lib/live/dj";
export function useMusicBed(volume:number,duck:boolean,enabled:boolean,mood:DjMood="groove",effects=true){
  const bed=useRef<MusicBed>();const generation=useRef(0);
  const settings=useRef({volume,duck,enabled,mood,effects});settings.current={volume,duck,enabled,mood,effects};
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{bed.current?.volume(volume,duck,enabled,effects);},[volume,duck,enabled,effects]);
  useEffect(()=>{bed.current?.mood(mood);},[mood]);
  useEffect(()=>{
    const resume=()=>{if(document.visibilityState==="visible")void bed.current?.unlock().catch(()=>{});};
    document.addEventListener("visibilitychange",resume);
    return()=>{document.removeEventListener("visibilitychange",resume);generation.current++;void bed.current?.stop();bed.current=undefined;};
  },[]);
  async function unlock(){const token=generation.current;const current=bed.current??(bed.current=new MusicBed());await current.unlock();if(token!==generation.current)throw new DOMException("Stopped","AbortError");}
  function start(){const s=settings.current;bed.current?.volume(s.volume,s.duck,s.enabled,s.effects);bed.current?.mood(s.mood);bed.current?.start();setPlaying(true);}
  function stop(){generation.current++;void bed.current?.stop();bed.current=undefined;setPlaying(false);}
  return {unlock,start,stop,playing};
}
