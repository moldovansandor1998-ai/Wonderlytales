"use client";
import { useEffect, useRef } from "react";
export default function BackdropVideo({ url, active, poster, onError }: { url: string; active: boolean; poster: string; onError?: () => void }) {
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    if (active) void video.play().catch(() => onError?.());
    else video.pause();
  }, [active, url, onError]);
  return <video ref={player} src={url} poster={poster} muted loop playsInline preload="auto" aria-label="Folyamatos mozgó alapjelenet" onError={onError} className="absolute inset-0 h-full w-full object-cover" />;
}
