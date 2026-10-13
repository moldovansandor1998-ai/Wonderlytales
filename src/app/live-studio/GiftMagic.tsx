"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { GiftEffect } from "@/lib/live/duo";
import styles from "./GiftMagic.module.css";

export default function GiftMagic({ effect }: { effect?: GiftEffect }) {
  const [activeId, setActiveId] = useState("");
  useEffect(() => {
    if (!effect) { setActiveId(""); return; }
    const remaining = effect.startedAt + effect.duration - Date.now();
    if (remaining <= 0) { setActiveId(""); return; }
    setActiveId(effect.id);
    const timer = setTimeout(() => setActiveId(""), remaining);
    return () => clearTimeout(timer);
  }, [effect?.id, effect?.startedAt, effect?.duration]);
  if (!effect || activeId !== effect.id) return null;
  const elapsed = Math.max(0, Date.now() - effect.startedAt);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label="Ajándék varázseffekt">
    <div className={`${styles.glow} ${styles[effect.kind]}`} />
    {Array.from({length: 18}, (_, i) => <span key={`${effect.id}-${i}`} aria-hidden="true" className={`${styles.particle} ${styles[effect.kind]}`} style={{left:`${8 + (i * 37) % 84}%`, "--delay": `${(i % 6) * 180 - elapsed}ms`, "--drift": `${((i * 29) % 100) - 50}px`} as CSSProperties}>{effect.kind === "hearts" ? "♥" : effect.kind === "petals" ? "❀" : "✦"}</span>)}
    <div className="absolute inset-x-5 top-24 rounded-2xl border border-white/30 bg-black/70 px-4 py-3 text-center text-sm text-white"><p className="font-semibold text-amber-200">Ali varázslata</p><p className="mt-1 break-words">{effect.label}</p></div>
  </div>;
}
