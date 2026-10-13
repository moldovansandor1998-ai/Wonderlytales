"use client";

import { useEffect, useRef, useState } from "react";

type Character = { id: string; name: string; personality: string; image: string; voiceId?: string; voiceName?: string };
const INITIAL: Character = { id: "pirate", name: "Kalóz kapitány", voiceName: "Mc istia", personality: "Csipkelődő, vidám magyar kalóz. Rövid válaszok, hajós humor.", image: "/live-studio/pirate.png" };
const button = "rounded bg-amber-400 px-4 py-2 text-black font-semibold disabled:opacity-40";

export default function LiveStudio() {
  const [characters, setCharacters] = useState<Character[]>([INITIAL]);
  const [selected, setSelected] = useState("pirate");
  const [text, setText] = useState("Ahoy, matrózok! Megérkezett a kapitány! Ki kér egy kis zenét?");
  const [message, setMessage] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [stage, setStage] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [music, setMusic] = useState("");
  const [volume, setVolume] = useState(0.4);
  const [accountVoices, setAccountVoices] = useState<{ id: string; name: string }[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [speechUrl, setSpeechUrl] = useState("");
  const speechAudio = useRef<HTMLAudioElement>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);
  const character = characters.find(c => c.id === selected) || INITIAL;

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("wonderly-live-characters-v1") || "null");
      if (Array.isArray(saved)) {
        const valid = saved.filter((c): c is Character => !!c && typeof c.id === "string" && typeof c.name === "string" && typeof c.personality === "string" && typeof c.image === "string" && (c.image === INITIAL.image || /^data:image\/(png|jpeg|webp);base64,/.test(c.image)));
        if (valid.length) setCharacters(valid);
      }
    } catch { setMessage("A mentett karaktereket nem sikerült betölteni."); }
    setReady(true);
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("hu")));
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", refresh); window.speechSynthesis.cancel(); urls.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("wonderly-live-characters-v1", JSON.stringify(characters)); }
    catch { setMessage("A böngésző tárhelye megtelt. A karakter képe nem lett elmentve."); }
  }, [characters, ready]);

  useEffect(() => { if (audio.current) audio.current.volume = speaking ? volume * 0.2 : volume; }, [volume, speaking, music]);
  useEffect(() => {
    const change = () => { if (!document.fullscreenElement) setStage(false); };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);

  function update(field: "name" | "personality" | "voiceId" | "voiceName", value: string) {
    setCharacters(current => current.map(c => c.id === character.id ? { ...c, [field]: value } : c));
  }
  function stop() { speechRequest.current?.abort(); speechAudio.current?.pause(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }
  function speak() {
    if (!("speechSynthesis" in window) || !voices.length) { setMessage("Nincs elérhető magyar böngészőhang. A magyar hangszolgáltatás még nincs bekötve."); return; }
    stop();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 1500));
    utterance.lang = "hu-HU";
    utterance.voice = voices.find(v => v.name === voiceName) || voices[0];
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => { setSpeaking(false); setMessage("A felolvasás megszakadt."); };
    setMessage("");
    window.speechSynthesis.speak(utterance);
  }
  async function loadVoices() {
    setLoadingVoices(true); setMessage("");
    try {
      const response = await fetch("/api/live-studio/voices");
      if (!response.ok) throw new Error("Az ElevenLabs hanglistája nem érhető el. Ellenőrizd a stúdió bejelentkezést és az ElevenLabs-kapcsolatot.");
      const data = await response.json(); setAccountVoices(data.voices);
      const target = (character.voiceName || "").trim().toLowerCase();
      const matches = data.voices.filter((v: {name: string}) => v.name.trim().toLowerCase() === target);
      if (matches.length === 1) { update("voiceId", matches[0].id); setMessage(`${matches[0].name} hang kiválasztva.`); }
      else setMessage(matches.length > 1 ? "Több azonos nevű hang van; válassz a listából." : "A keresett hang nem található ebben az ElevenLabs-fiókban; válassz a listából.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Hanglista hiba"); }
    finally { setLoadingVoices(false); }
  }
  async function elevenSpeak() {
    stop();
    const controller = new AbortController(); speechRequest.current = controller;
    setVoiceBusy(true); setMessage("");
    try {
      const response = await fetch("/api/live-studio/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 1000), voiceId: character.voiceId }), signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error === "ELEVENLABS_NOT_CONFIGURED" ? "Az ElevenLabs szerverkapcsolat nincs beállítva." : "A hangkészítés nem sikerült. Ellenőrizd a Voice ID-t és a szolgáltatás keretét."); }
      const url = URL.createObjectURL(await response.blob()); urls.current.push(url);
      if (controller.signal.aborted) return;
      if (speechUrl) URL.revokeObjectURL(speechUrl);
      setSpeechUrl(url);
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Hanghiba"); }
    finally { if (speechRequest.current === controller) setVoiceBusy(false); }
  }
  useEffect(() => { if (speechUrl && speechAudio.current) void speechAudio.current.play().catch(() => setMessage("A hang elkészült. Indítsd el a lejátszón.")); }, [speechUrl]);
  useEffect(() => () => { speechRequest.current?.abort(); }, []);

  async function showStage() {
    setStage(true);
    try { await screen.current?.requestFullscreen(); }
    catch { setMessage("Teljes képernyő nem érhető el; az adáskép külön nézetben látható."); }
  }

  return <div ref={screen} className={stage ? "fixed inset-0 z-50 bg-black overflow-auto" : "space-y-6"}>
    {stage ? <button className="fixed right-2 top-2 z-50 rounded bg-black/70 p-2 text-white" onClick={() => { setStage(false); if (document.fullscreenElement) void document.exitFullscreen(); }}>Vissza a stúdióba</button> : <>
      <h1 className="text-3xl font-bold">Élő karakterstúdió</h1>
      <p className="text-zinc-400">Külön műsorstúdió • Karakterek váltása adásonként • TikTok adáskép előkészítése</p>
      <div className="rounded border border-amber-700 p-4 text-amber-200">Előkészítési mód. TikTok nincs csatlakoztatva. Az AI-válaszok és a szájmozgás még nincsenek bekötve. ElevenLabs hangpróba Voice ID-val indítható; a karakter jelenleg állókép.</div>
    </>}
    <div className={stage ? "h-screen flex justify-center" : "grid gap-6 lg:grid-cols-2"}>
      <div className="relative aspect-[9/16] max-h-[85vh] overflow-hidden rounded-lg bg-black mx-auto w-full max-w-sm">
        {/* User-provided data images and the bundled character are displayed directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={character.image} alt={character.name} className="h-full w-full object-cover" />
        <div className="absolute top-3 left-3 rounded bg-black/70 px-3 py-1 text-xs text-white">AI-karakter • {speaking ? "Próbafelolvasás" : "Előnézet"}</div>
        <div className="absolute bottom-4 left-4 right-4 rounded bg-black/70 p-3 text-white"><strong>{character.name}</strong><p className="text-sm">{speaking ? text : "Üdv a fedélzeten!"}</p></div>
      </div>
      {!stage && <div className="space-y-5">
        <section className="space-y-3 rounded border border-zinc-700 p-4">
          <h2 className="text-xl font-semibold">Az adás karaktere</h2>
          <label className="block">Karakter<select className="block w-full rounded bg-zinc-800 p-2" value={character.id} onChange={e => { stop(); setSelected(e.target.value); }}>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button className={button} onClick={() => { stop(); const id = crypto.randomUUID(); setCharacters(c => [...c, { ...INITIAL, id, name: "Új karakter" }]); setSelected(id); }}>Új karakter hozzáadása</button>
          <label className="block">Név<input maxLength={80} className="block w-full rounded bg-zinc-800 p-2" value={character.name} onChange={e => update("name", e.target.value)} /></label>
          <label className="block">Személyiség a későbbi AI-válaszokhoz<textarea maxLength={2000} className="block w-full rounded bg-zinc-800 p-2" value={character.personality} onChange={e => update("personality", e.target.value)} /></label>
          <label className="block">Karakterkép (PNG, JPG, WebP; legfeljebb 2 MB)<input className="block w-full" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
            const file = e.target.files?.[0]; const id = character.id;
            if (!file) return;
            if (file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMessage("PNG, JPG vagy WebP képet válassz, legfeljebb 2 MB méretben."); return; }
            const reader = new FileReader(); reader.onerror = () => setMessage("A kép nem olvasható."); reader.onload = () => { const image = String(reader.result); setCharacters(current => current.map(c => c.id === id ? { ...c, image } : c)); }; reader.readAsDataURL(file);
          }} /></label>
          <p className="text-xs text-zinc-400">A karakterlista ezen a böngészőn marad meg. Másik eszközre még nem szinkronizálódik.</p>
        </section>
        <section className="space-y-3 rounded border border-zinc-700 p-4">
          <h2 className="text-xl font-semibold">Hangpróba</h2>
          <label className="block">Keresett ElevenLabs-hang neve<input className="block w-full rounded bg-zinc-800 p-2" maxLength={100} value={character.voiceName || ""} onChange={e => update("voiceName", e.target.value)} /></label>
          <button className={button} disabled={loadingVoices} onClick={() => void loadVoices()}>{loadingVoices ? "Hangok betöltése…" : "ElevenLabs hangok betöltése"}</button>
          {accountVoices.length > 0 && <label className="block">Fiókhang kiválasztása<select className="block w-full rounded bg-zinc-800 p-2" value={character.voiceId || ""} onChange={e => { update("voiceId", e.target.value); const voice = accountVoices.find(v => v.id === e.target.value); if (voice) update("voiceName", voice.name); }}><option value="">Válassz hangot</option>{accountVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
          <label className="block">ElevenLabs Voice ID<input maxLength={100} className="block w-full rounded bg-zinc-800 p-2" value={character.voiceId || ""} onChange={e => update("voiceId", e.target.value.replace(/[^a-zA-Z0-9]/g, ""))} /></label>
          <button className={button} disabled={voiceBusy || !character.voiceId || !text.trim()} onClick={() => void elevenSpeak()}>{voiceBusy ? "Hang készül…" : "ElevenLabs hangpróba"}</button>
          <p className="text-xs text-zinc-400">A hangpróba az ElevenLabs keretét használja, a stúdió költségkorlátjával. Az API-kulcs a szerveren marad. Nem készít szájmozgást.</p>
          <label className="block">Magyar böngészőhang<select className="block w-full rounded bg-zinc-800 p-2" value={voiceName} onChange={e => setVoiceName(e.target.value)}><option value="">{voices.length ? "Alapértelmezett magyar hang" : "Nincs magyar hang ezen az eszközön"}</option>{voices.map(v => <option key={v.voiceURI} value={v.name}>{v.name}</option>)}</select></label>
          <label className="block">Próbaszöveg<textarea maxLength={1500} className="block w-full rounded bg-zinc-800 p-2" value={text} onChange={e => setText(e.target.value)} /></label>
          <div className="flex gap-3"><button className={button} disabled={!text.trim() || !voices.length} onClick={speak}>Felolvasás</button><button className={button} onClick={stop}>Beszéd leállítása</button></div>
        </section>
        <section className="space-y-3 rounded border border-zinc-700 p-4">
          <h2 className="text-xl font-semibold">Zenepróba</h2>
          <label className="block">Saját, közvetítésre jogosított hangfájl<input className="block" type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (music) URL.revokeObjectURL(music); const url = URL.createObjectURL(file); urls.current.push(url); setMusic(url); }} /></label>
          <label className="block">Zene hangereje<input className="block w-full" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
          <p className="text-xs text-zinc-400">Beszéd közben a zene automatikusan halkul. Kommentes zenekérés még nincs csatlakoztatva.</p>
        </section>
        <button className={button} onClick={() => void showStage()}>Adáskép megnyitása</button>
        <section className="rounded border border-zinc-700 p-4 space-y-2"><h2 className="text-xl font-semibold">TikTok közvetítés</h2><ol className="list-decimal pl-5 space-y-2"><li>Számítógépen jelentkezz be a TikTok LIVE Studio alkalmazásba, és ellenőrizd a LIVE-hozzáférést.</li><li>Nyisd meg az adásképet, majd rögzítsd a böngésző ablakát a LIVE Studio alkalmazásban.</li><li>Állíts be álló, 9:16-os képet és számítógépes hangrögzítést. Ellenőrizd külön a beszédet és a zenét.</li><li>A közvetítést a LIVE Studio alkalmazásban indítsd. Ez a gomb csak előnézetet nyit, nem indít TikTok-adást.</li></ol><p className="text-zinc-400 text-sm">A folyamatos komment- és ajándékfigyeléshez külön futó összekötő szükséges. Az automatikus válaszadás ehhez és egy AI-szolgáltatáshoz csatlakozik majd.</p></section>
        {message && <p role="status" className="text-amber-300">{message}</p>}
      </div>}
    </div>
    {speechUrl && <audio ref={speechAudio} src={speechUrl} controls onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} className={stage ? "fixed bottom-12 left-2 opacity-0 hover:opacity-100" : "w-full"} />}
    {music && <audio ref={audio} src={music} controls loop className={stage ? "fixed bottom-2 left-2 opacity-0 hover:opacity-100" : "w-full"} />}
  </div>;
}
