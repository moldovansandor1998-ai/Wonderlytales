"use client";
import { useEffect, useRef, useState } from "react";
import { MusicBed } from "@/lib/live/music-bed";
import type { MusicMood } from "@/lib/live/music-director";
export function useMusicBed(volume:number,duck:boolean,enabled:boolean,mood:MusicMood="groove"){
  const bed=useRef<MusicBed>();const generation=useRef(0);
  const settings=useRef({volume,duck,enabled,mood});settings.current={volume,duck,enabled,mood};
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{if(playing)bed.current?.volume(volume,duck,enabled);},[volume,duck,enabled,playing]);
  useEffect(()=>{bed.current?.setMood(mood);},[mood]);
  useEffect(()=>{
    const resume=()=>{if(document.visibilityState==="visible")void bed.current?.unlock().catch(()=>{});};
    document.addEventListener("visibilitychange",resume);
    return()=>{document.removeEventListener("visibilitychange",resume);generation.current++;void bed.current?.dispose();bed.current=undefined;};
  },[]);
  async function unlock(player?:HTMLAudioElement|null){const token=generation.current;const current=bed.current??(bed.current=new MusicBed());await current.unlock(player);if(token!==generation.current)throw new DOMException("Stopped","AbortError");}
  function start(){const s=settings.current;bed.current?.volume(s.volume,s.duck,s.enabled);bed.current?.setMood(s.mood);bed.current?.start();setPlaying(true);}
  function stop(){generation.current++;bed.current?.stop();setPlaying(false);}
  function accent(){bed.current?.accent(settings.current.enabled);}
  function fadeTrack(level:number,seconds:number){bed.current?.fadeTrack(level,seconds);}
  return {unlock,start,stop,playing,accent,fadeTrack};
}
