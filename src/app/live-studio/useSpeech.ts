"use client";
import { useEffect, useRef, useState } from "react";
import type { Alignment } from "@/lib/live/speech";

export function useSpeech() {
  const element = useRef<HTMLAudioElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [timed, setTimed] = useState(false);
  const [word, setWord] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("hu")));
    refresh(); window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  async function unlock(player: HTMLMediaElement | null = element.current) {
    if (!player) throw new Error("A hanglejátszó nem elérhető.");
    const bytes = new Uint8Array(844);
    const view = new DataView(bytes.buffer);
    const put = (at: number, value: string) => [...value].forEach((c, i) => bytes[at + i] = c.charCodeAt(0));
    put(0, "RIFF"); view.setUint32(4, 836, true); put(8, "WAVEfmt "); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, "data"); view.setUint32(40, 800, true);
    const url = URL.createObjectURL(new Blob([bytes], {type:"audio/wav"}));
    try { player.src = url; await player.play(); player.pause(); player.removeAttribute("src"); player.load(); }
    finally { URL.revokeObjectURL(url); }
  }

  async function say(text: string, mode: "eleven" | "browser", voiceId: string | undefined, signal: AbortSignal, onStart?: () => void) {
    signal.throwIfAborted(); setTimed(false); setWord("");
    if (mode === "browser") {
      if (!voices.length) throw new Error("Nincs magyar böngészőhang ezen az eszközön. Válassz ElevenLabs-hangot.");
      return new Promise<void>((resolve, reject) => {
        let finished = false;
        const utterance = new SpeechSynthesisUtterance(text); utterance.voice = voices[0]; utterance.lang = "hu-HU";
        const done = (error?: Error) => { if (finished) return; finished = true; clearTimeout(watchdog); signal.removeEventListener("abort", cancel); setSpeaking(false); utterance.onend = null; utterance.onerror = null; error ? reject(error) : resolve(); };
        const cancel = () => { window.speechSynthesis.cancel(); done(new DOMException("Stopped", "AbortError")); };
        const watchdog = setTimeout(() => { window.speechSynthesis.cancel(); done(new Error("A felolvasás időtúllépés miatt leállt.")); }, 120000);
        signal.addEventListener("abort", cancel, {once: true});
        utterance.onstart = () => { setSpeaking(true); onStart?.(); }; utterance.onend = () => done(); utterance.onerror = () => done(new Error("A felolvasás megszakadt."));
        window.speechSynthesis.speak(utterance);
      });
    }
    if (!voiceId) throw new Error("Előbb válaszd ki a karakter ElevenLabs-hangját.");
    const response = await fetch("/api/live-studio/speech", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({text, voiceId}), signal});
    if (!response.ok) throw new Error("A hangkészítés nem sikerült. Ellenőrizd a Voice ID-t, a bejelentkezést és a stúdió költségkeretét.");
    const data: {audio: string; alignment: Alignment | null} = await response.json();
    signal.throwIfAborted();
    const player = element.current;
    if (!player) throw new Error("A hanglejátszó nem elérhető.");
    const bytes = Uint8Array.from(atob(data.audio), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], {type:"audio/mpeg"}));
    setTimed(!!data.alignment);
    try {
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const done = (error?: Error) => {
          if (finished) return; finished = true; clearTimeout(watchdog);
          signal.removeEventListener("abort", cancel);
          player.onended = null; player.onerror = null; player.onplaying = null; player.onpause = null; player.ontimeupdate = null;
          player.pause(); player.removeAttribute("src"); player.load(); setSpeaking(false); setWord("");
          error ? reject(error) : resolve();
        };
        const cancel = () => done(new DOMException("Stopped", "AbortError"));
        const watchdog = setTimeout(() => done(new Error("A hang lejátszása túl sokáig tartott; a műsor megállt.")), 120000);
        signal.addEventListener("abort", cancel, {once:true});
        let started = false;
        player.onplaying = () => { setSpeaking(true); if (!started) { started = true; onStart?.(); } }; player.onpause = () => setSpeaking(false);
        player.onended = () => done(); player.onerror = () => done(new Error("A hangfájl nem játszható le."));
        player.ontimeupdate = () => {
          const a = data.alignment;
          if (!a) return;
          const i = a.character_start_times_seconds.findIndex((s, index) => s <= player.currentTime && a.character_end_times_seconds[index] > player.currentTime);
          if (i < 0) { setWord(""); return; }
          let start = i, end = i;
          while (start > 0 && !/\s/.test(a.characters[start - 1])) start--;
          while (end < a.characters.length && !/\s/.test(a.characters[end])) end++;
          setWord(a.characters.slice(start, end).join(""));
        };
        player.src = url;
        void player.play().catch(() => done(new Error("A böngésző letiltotta a hangot. Kattints a Hangpróba gombra, majd indítsd újra a sort.")));
      });
    } finally { URL.revokeObjectURL(url); }
  }
  return { element, speaking, timed, word, say, unlock };
}
