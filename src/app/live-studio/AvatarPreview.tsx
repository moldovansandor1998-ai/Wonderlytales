"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarSession } from "@runwayml/avatars";

type Configuration = { runway: boolean; character: boolean; elevenlabs: boolean; agent: boolean };
const explanations: Record<string, string> = {
  AVATAR_NOT_CONFIGURED: "A Runway–ElevenLabs kapcsolat még nincs beállítva.",
  RUNWAY_CHARACTER_NOT_READY: "A Runway-karakter feldolgozása még nem sikerült. Ellenőrizd a karakter adatlapját.",
  RUNWAY_ACCESS_DENIED: "A Runway-kulcs nem fér hozzá ehhez a projekthez.",
  RUNWAY_CREDITS_REQUIRED: "Ebben a Runway fejlesztői projektben nincs elegendő API-kredit. A Pro webes előfizetés kreditje külön keret.",
  ELEVENLABS_AGENT_ACCESS_DENIED: "Az ElevenLabs Agent nem érhető el a stúdió kulcsával.",
  ELEVENLABS_AGENT_SETTINGS_REQUIRED: "Az ElevenLabs Agent beállítása szükséges: magyar nyelv, Mc istia hang, PCM 16000 Hz bemenet és legfeljebb 60 másodperc.",
  AVATAR_REQUEST_ALREADY_USED: "Ez a próbamenet már elindult. Leállítás után indíthatsz újat.",
  AVATAR_CLEANUP_PENDING: "A leállítás még nem igazolható. A szolgáltató 60 másodperces időkorlátja érvényben marad.",
  VIDEO_SERVICE_UNAVAILABLE: "A kapcsolat vagy az ellenőrzött költségkeret még nem áll rendelkezésre.",
};
const describe = (code: string) => explanations[code] || "A Runway-kapcsolat nem sikerült. Ellenőrizd a szolgáltatói hozzáférést; a próba leállt.";
const endpoint = "/api/live-studio/avatar";

export default function AvatarPreview({ configuration, disabled, stopSignal, onActive }: {
  configuration?: Configuration; disabled: boolean; stopSignal: number; onActive: (active: boolean) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "starting" | "active" | "stopping">("idle");
  const [message, setMessage] = useState("");
  const [caption, setCaption] = useState("");
  const [seconds, setSeconds] = useState(60);
  const [muted, setMuted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const session = useRef<AvatarSession | null>(null);
  const attempt = useRef<{ id: string; cancelled: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const mounted = useRef(true);
  const callback = useRef(onActive); callback.current = onActive;
  const stopRef = useRef<() => Promise<void>>(async () => {});
  const configured = !!configuration && Object.values(configuration).every(Boolean);

  async function cancelRemote(id: string) {
    // Retrying DELETE is safe; session creation is never automatically retried.
    for (let i = 0; i < 2; i++) {
      try {
        const result = await fetch(endpoint, { method: "DELETE", keepalive: true,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id }), signal: AbortSignal.timeout(25000) });
        if (result.ok) return true;
      } catch { /* Provider duration limit is the final backstop. */ }
    }
    return false;
  }
  async function stop() {
    const current = attempt.current;
    if (!current || current.cancelled) return;
    current.cancelled = true;
    if (mounted.current) setPhase("stopping");
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    const connected = session.current; session.current = null;
    const ended = connected?.end().catch(() => {});
    const stopped = await cancelRemote(current.id);
    await ended;
    if (attempt.current === current) attempt.current = null;
    if (mounted.current) {
      callback.current(false); setPhase("idle"); setMuted(false);
      if (!stopped) setMessage(explanations.AVATAR_CLEANUP_PENDING);
    }
  }
  stopRef.current = stop;
  useEffect(() => {
    mounted.current = true;
    const leave = () => { void stopRef.current(); };
    window.addEventListener("pagehide", leave);
    return () => { mounted.current = false; window.removeEventListener("pagehide", leave); void stopRef.current(); };
  }, []);
  useEffect(() => { if (stopSignal) void stopRef.current(); }, [stopSignal]);

  async function start() {
    if (attempt.current || disabled || !configured) return;
    const current = { id: crypto.randomUUID(), cancelled: false };
    attempt.current = current; setPhase("starting"); setCaption(""); setMessage(""); setSeconds(60); callback.current(true);
    try {
      // Ask for mic permission before starting either paid provider.
      const permission = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      permission.getTracks().forEach(track => track.stop());
      if (current.cancelled) return;
      const created = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: current.id }), signal: AbortSignal.timeout(65000) });
      if (current.cancelled) { await cancelRemote(current.id); return; }
      if (!created.ok) throw new Error(describe((await created.json()).error));
      const deadline = Date.now() + 45000;
      let credentials: { sessionId: string; sessionKey: string } | undefined;
      while (!current.cancelled && Date.now() < deadline) {
        const response = await fetch(`${endpoint}?requestId=${current.id}`, { cache: "no-store", signal: AbortSignal.timeout(25000) });
        if (!response.ok) throw new Error(describe((await response.json()).error));
        const data = await response.json();
        if (data.status === "READY") { credentials = data; break; }
        if (data.status !== "NOT_READY") throw new Error("A próbamenet már lezárult vagy a Runway hibát jelzett.");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (current.cancelled) return;
      if (!credentials || !video.current) throw new Error("A Runway nem készült el időben. Új próbát kézzel indíthatsz.");
      const { streamTo, AvatarEvent } = await import("@runwayml/avatars");
      if (current.cancelled) return;
      const connected = await streamTo({ credentials, target: video.current, audio: true, video: false });
      if (current.cancelled) { await connected.end(); await cancelRemote(current.id); return; }
      session.current = connected;
      if (audio.current) connected.attachAudio(audio.current);
      connected.on(AvatarEvent.Transcript, entry => { if (mounted.current) setCaption(entry.text); });
      connected.on(AvatarEvent.Error, () => { if (mounted.current) setMessage("A Runway-kapcsolat megszakadt."); void stopRef.current(); });
      connected.on(AvatarEvent.StateChanged, state => { if (["ended", "error"].includes(state)) void stopRef.current(); });
      setPhase("active");
      const until = Date.now() + 60000;
      timer.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        if (mounted.current) setSeconds(remaining);
        if (!remaining) void stopRef.current();
      }, 500);
    } catch (e) {
      if (mounted.current && !current.cancelled) setMessage(e instanceof Error ? e.message : "A próba nem indult el.");
      await stopRef.current();
    }
  }

  return <section className="space-y-4 rounded-2xl border border-sky-800 bg-sky-950/20 p-5">
    <div><h2 className="text-xl font-semibold">Runway – élő karakterpróba</h2><p className="mt-2 text-sm text-zinc-300">Kalóz kapitány • Mc istia hang • legfeljebb 60 másodperc</p></div>
    <p className="text-sm text-zinc-400">Beszélj a mikrofonba, és ellenőrizd a karakter hangját, mozgását és válaszait. A próba külön jelenik meg; a TikTok-kommenteket és az adásablakot még nem vezérli.</p>
    {!configured && <p className="rounded-lg bg-zinc-900 p-3 text-sm">A kapcsolathoz még hiányzik: {configuration ? [!configuration.runway && "Runway fejlesztői hozzáférés", !configuration.character && "feldolgozott Runway-karakter", !configuration.elevenlabs && "ElevenLabs-hozzáférés", !configuration.agent && "ElevenLabs Agent"].filter(Boolean).join(", ") : "a hozzáférések ellenőrzése"}.</p>}
    <div className={phase === "idle" ? "hidden" : "space-y-2"}>
      <video ref={video} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black object-contain" />
      <audio ref={audio} controls autoPlay className="w-full" />
      <p className="min-h-6 text-sm" aria-live="polite">{caption}</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button className="rounded-lg bg-sky-300 px-4 py-2 font-semibold text-black disabled:opacity-40" disabled={disabled || !configured || phase !== "idle"} onClick={() => void start()}>Egyperces élő próba indítása</button>
      {phase !== "idle" && <button className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-40" disabled={phase === "stopping"} onClick={() => void stop()}>{phase === "stopping" ? "Leállítás…" : "Próba leállítása"}</button>}
      {phase === "active" && <><span>{seconds} mp</span><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={async () => { try { await session.current?.mic.toggle(); setMuted(!session.current?.mic.isEnabled); } catch { setMessage("A mikrofon nem kapcsolható."); } }}>{muted ? "Mikrofon bekapcsolása" : "Mikrofon némítása"}</button></>}
      {phase === "starting" && <span role="status">Kapcsolódás…</span>}
    </div>
    <p className="text-sm text-zinc-300">A Runway Pro webes kreditje és az élő avatar fejlesztői API-kerete külön van. A webes 2500 kredit nem jelenik meg az API-egyenlegben.</p>
    <p className="text-xs text-zinc-400">A próba Runway- és ElevenLabs-keretet fogyaszt. A szerver indulás előtt ellenőrzi a karaktert, a hangot és a költségkeretet. Nem indul újra automatikusan.</p>
    {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
  </section>;
}
