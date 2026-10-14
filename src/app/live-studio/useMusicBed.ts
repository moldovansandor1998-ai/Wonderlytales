"use client";
import { useEffect, useRef, useState } from "react";
import { MusicBed } from "@/lib/live/music-bed";
export function useMusicBed(volume:number,duck:boolean,enabled:boolean){
  const bed=useRef<MusicBed>();const generation=useRef(0);
  const settings=useRef({volume,duck,enabled});settings.current={volume,duck,enabled};
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{bed.current?.volume(enabled?volume:0,duck);},[volume,duck,enabled]);
  useEffect(()=>{
    const resume=()=>{if(document.visibilityState==="visible")void bed.current?.unlock().catch(()=>{});};
    document.addEventListener("visibilitychange",resume);
    return()=>{document.removeEventListener("visibilitychange",resume);generation.current++;void bed.current?.stop();bed.current=undefined;};
  },[]);
  async function unlock(){const token=generation.current;const current=bed.current??(bed.current=new MusicBed());await current.unlock();if(token!==generation.current)throw new DOMException("Stopped","AbortError");}
  function start(){const s=settings.current;bed.current?.volume(s.enabled?s.volume:0,s.duck);bed.current?.start();setPlaying(true);}
  function stop(){generation.current++;void bed.current?.stop();bed.current=undefined;setPlaying(false);}
  return {unlock,start,stop,playing};
}
