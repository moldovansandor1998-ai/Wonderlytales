"use client";
import { useEffect, useRef } from "react";
import type { MotionFrame } from "./useMotion";
export default function MotionVideo({frame}:{frame:MotionFrame}) {
  const ref=useRef<HTMLVideoElement>(null);
  const latest=useRef(frame);latest.current=frame;
  function sync() {
    const video=ref.current,current=latest.current;if(!video)return;
    if(video.readyState>=1 && Math.abs(video.currentTime-current.position)>0.3)video.currentTime=current.position;
    if(current.playing)void video.play().catch(()=>{});else video.pause();
  }
  useEffect(sync,[frame.position,frame.playing,frame.url]);
  return <video ref={ref} src={frame.url} muted playsInline onLoadedMetadata={sync} aria-label="Runway beszélő karakter" className="absolute inset-0 h-full w-full object-contain bg-black/70" />;
}
