"use client";
import type { RefObject } from "react";
import NpcPlayer, { type NpcPlayback } from "./NpcPlayer";
import type { NpcAssets } from "./useNpc";
import type { MotionFrame } from "./useMotion";
import MotionVideo from "./MotionVideo";
import GiftMagic from "./GiftMagic";
import BackdropVideo from "./BackdropVideo";
import { CAST } from "@/lib/live/duo";
import type { StageState } from "@/lib/live/stage";
export default function Stage({ state, full = false, playbackRef, onBackdropError, npcAssets, npcRef, onNpcFrame }: { state: StageState; full?: boolean; playbackRef?: RefObject<HTMLVideoElement>; onBackdropError?: (message: string) => void; npcAssets?: NpcAssets; npcRef?: RefObject<NpcPlayback>; onNpcFrame?: (frame:MotionFrame)=>void }) {
  return <div className={`relative isolate aspect-[9/16] overflow-hidden bg-black ${full ? "h-[100dvh] w-[min(100vw,56.25dvh)]" : "w-full max-w-sm rounded-2xl shadow-xl"}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={state.image} alt={state.name} className="h-full w-full object-cover" />
    {state.npc && (npcAssets ? <NpcPlayer ref={npcRef} assets={npcAssets} active={state.npc.active} onError={onBackdropError} onFrame={onNpcFrame} /> : state.npc.frame && <MotionVideo frame={{...state.npc.frame,playing:state.npc.active&&state.npc.frame.playing}} />)}
    {state.backdrop && <BackdropVideo url={state.backdrop.url} active={state.backdrop.active} poster={state.image} onError={onBackdropError} />}
    {playbackRef ? <video ref={playbackRef} playsInline aria-label="A karakter képe és hangja" className={`absolute inset-0 h-full w-full object-cover bg-black ${state.motion ? "" : "invisible"}`} /> : state.motion && <MotionVideo key={state.motion.id} frame={state.motion} />}
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />
    <div className="absolute left-5 right-5 top-5 flex justify-between items-center gap-2"><span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">{state.scene === "duo" ? "AI-paródia • Ali és Mc Isti" : "AI-karakter"}</span><span className={`rounded-full px-3 py-1 text-xs ${state.connected ? "bg-emerald-600" : "bg-zinc-800"} text-white`}>{state.connected ? "Kommentkapcsolat aktív" : "Stúdiópróba"}</span></div>
    <GiftMagic effect={state.effect} />
    {state.showStatus && !state.speaking && <p className="absolute inset-x-5 top-16 text-center text-xs text-white/80">{state.showStatus}</p>}
    {state.scene !== "duo" && state.emotion === "thanks" && state.speaking && <div className="absolute top-24 inset-x-5 rounded-2xl bg-amber-300/95 p-4 text-center text-black font-bold motion-safe:animate-pulse">🎁 Köszönöm az ajándékot!</div>}
    <div className="absolute bottom-10 left-6 right-6 space-y-3 text-white"><p className="text-xs uppercase tracking-[0.3em] text-amber-300">WonderlyTales Live</p><h2 className="text-2xl font-bold">{state.scene === "duo" && state.speaker ? CAST[state.speaker].name : state.name}</h2><p className="text-lg leading-relaxed break-words" aria-live="off">{state.caption}</p>{state.song && <p className="text-sm text-amber-200">♫ {state.song}</p>}{state.speaking && <div className="flex gap-1" aria-label="A karakter beszél">{[12, 22, 15, 28, 18].map((height, i) => <span key={i} style={{height, animationDelay: `${i * 100}ms`}} className="w-1 rounded bg-amber-300 motion-safe:animate-pulse" />)}</div>}</div>
  </div>;
}
