"use client";

import { useEffect, useRef, useState } from "react";
import { eventSchema, replySchema, EventQueue, rehearsalReply, songRequest, type LiveEvent, type Reply, type Emotion } from "@/lib/live/events";
import { readAIResponse } from "@/lib/live/client";
import type { StageState } from "@/lib/live/stage";
import Stage from "./Stage";
import DuoVoices from "./DuoVoices";
import { CAST, DUO_IMAGE, dialogueSchema, giftEffect, playDialogue, rehearsalDialogue, type CastVoices, type Dialogue, type GiftEffect, type Speaker } from "@/lib/live/duo";
import { useMotion } from "./useMotion";
import MotionHistory from "./MotionHistory";
import AvatarPreview from "./AvatarPreview";
import { useSpeech } from "./useSpeech";

type Character = { id: string; name: string; personality: string; image: string; voiceId?: string; voiceName?: string };
type Track = { id: string; title: string; url: string };
type Log = { event: LiveEvent; reply: string; source?: "ai" | "rehearsal"; error?: boolean };
const INITIAL: Character = { id: "pirate", name: "Mc Isti", voiceName: "Mc istia", voiceId: "f9YzCDZYS8Zjl6RbHErx", personality: "Pukkancs, sértődős, nagyszájú magyar trash-karikatúra. Az aktuális kommentre rövid felháborodással reagál, aztán önironikusan visszakozik. Hétköznapi beszéd, semmi kalózos vagy hajós szófordulat. Kitalált AI-paródia, nem a valódi személy.", image: "/live-studio/pirate.png" };
const button = "rounded-lg bg-amber-400 px-4 py-2 text-black font-semibold disabled:opacity-40";
const field = "block w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2";
const panel = "space-y-3 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-5";
const normalize = (s: string) => s.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export default function LiveStudio() {
  const [characters, setCharacters] = useState<Character[]>([INITIAL]);
  const [selected, setSelected] = useState("pirate");
  const [scene, setScene] = useState<"solo" | "duo">("duo");
  const [castVoices, setCastVoices] = useState<CastVoices>({ali:CAST.ali.voiceId, isti:CAST.isti.voiceId});
  const [speaker, setSpeaker] = useState<Speaker | undefined>();
  const [effect, setEffect] = useState<GiftEffect | undefined>();
  const [ready, setReady] = useState(false);
  const character = characters.find(c => c.id === selected) || characters[0] || INITIAL;
  const [text, setText] = useState("Mi az, hogy már megint duzzogok?! Jó, egy kicsit. De csak amíg el nem indul a zene.");
  const [caption, setCaption] = useState("Ali varázsol. Isti duzzog. Kezdődhet a műsor!");
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [message, setMessage] = useState("");
  const [speechBusy, setBusy] = useState(false);
  const [avatarTesting, setAvatarTesting] = useState(false);
  const [avatarStop, setAvatarStop] = useState(0);
  const busy = speechBusy || avatarTesting;
  const [mode, setMode] = useState<"ai" | "rehearsal">("ai");
  const [voiceMode, setVoiceMode] = useState<"eleven" | "browser">("eleven");
  const [service, setService] = useState<{ai: boolean; aiModel?: string; aiProvider?: "gateway" | "story" | "wavespeed" | null; voice: boolean; motion?: {configured:boolean}; avatar?: {runway:boolean; character:boolean; elevenlabs:boolean; agent:boolean}} | null>(null);
  const [accountVoices, setAccountVoices] = useState<{id:string; name:string}[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [aiPreview, setAIPreview] = useState<Dialogue | null>(null);
  const speech = useSpeech();
  const motion = useMotion();
  const [motionMode,setMotionMode]=useState(false);
  const isSpeaking=speech.speaking || motion.speaking;
  const operation = useRef<AbortController | null>(null);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const queue = useRef(new EventQueue());
  const [pending, setPending] = useState<LiveEvent[]>([]);
  const [dropped, setDropped] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const history = useRef<Log[]>([]);
  const [replies, setReplies] = useState(0);
  const [limit, setLimit] = useState(100);
  const replyCount = useRef(0);
  const processRef = useRef<() => Promise<void>>(async () => {});
  const [testGift, setTestGift] = useState("rózsa");
  const [testUser, setTestUser] = useState("Próbanéző");
  const [testText, setTestText] = useState("Ali, miért duzzog már megint Isti?");
  const [connected, setConnected] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState("Nincs kapcsolat");
  const [username, setUsername] = useState("");
  const [pairing, setPairing] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const enqueueRef = useRef<(event: LiveEvent) => void>(() => {});
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState("");
  const [requests, setRequests] = useState<{user:string; title:string}[]>([]);
  const [volume, setVolume] = useState(0.35);
  const [autoMusic, setAutoMusic] = useState(true);
  const music = useRef<HTMLAudioElement>(null);
  const objectUrls = useRef(new Set<string>());
  const channel = useRef<BroadcastChannel | null>(null);
  const outputId = useRef("");
  const activeTrack = tracks.find(t => t.id === currentTrack);
  const state: StageState = {name:scene === "duo" ? "Ali és Mc Isti" : character.name, image:scene === "duo" ? DUO_IMAGE : character.image, caption, speaking:isSpeaking, emotion, connected, song:activeTrack?.title || "", scene, speaker, effect, motion:motion.frame};
  const stageRef = useRef(state); stageRef.current = state;

  useEffect(() => {
    try {
      const duo = JSON.parse(localStorage.getItem("wonderly-live-duo-v1") || "null");
      if (duo?.scene === "solo" || duo?.scene === "duo") setScene(duo.scene);
      if (typeof duo?.voices?.ali === "string" && typeof duo?.voices?.isti === "string" && /^[a-zA-Z0-9]{1,100}$/.test(duo.voices.ali) && /^[a-zA-Z0-9]{1,100}$/.test(duo.voices.isti)) setCastVoices(duo.voices);
      const saved = JSON.parse(localStorage.getItem("wonderly-live-characters-v1") || "null");
      if (Array.isArray(saved)) {
        const valid = saved.filter((c): c is Character => !!c && typeof c.id === "string" && typeof c.name === "string" && typeof c.personality === "string" && typeof c.image === "string" && (c.image === INITIAL.image || /^data:image\/(png|jpeg|webp);base64,/.test(c.image)));
        if (valid.length) { setCharacters(valid.map(c => c.id === "pirate" && /kalóz|hajós humor/i.test(c.personality) ? {...c, name: INITIAL.name, personality: INITIAL.personality, voiceId:c.voiceId || INITIAL.voiceId} : c.id === "pirate" && !c.voiceId && (!c.voiceName || c.voiceName.trim().toLowerCase() === "mc istia") ? {...c, voiceId: INITIAL.voiceId} : c)); setSelected(valid[0].id); }
      }
    } catch { setMessage("A mentett karakterek nem olvashatók."); }
    setReady(true);
    const controller = new AbortController();
    void fetch("/api/live-studio/status", {signal:controller.signal}).then(async r => { if (r.ok) setService(await r.json()); else setMessage("A szolgáltatások ellenőrzéséhez stúdiójogosultság és bejelentkezés szükséges."); }).catch(() => {});
    outputId.current = crypto.randomUUID();
    const c = new BroadcastChannel(`wonderly-live-${outputId.current}`); channel.current = c;
    const publish = () => c.postMessage({type:"state", state:stageRef.current});
    c.onmessage = e => { if (e.data?.type === "ready") publish(); };
    const heartbeat = setInterval(publish, 2000);
    return () => { controller.abort(); autoRef.current = false; operation.current?.abort(); socket.current?.close(); clearInterval(heartbeat); c.close(); objectUrls.current.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("wonderly-live-characters-v1", JSON.stringify(characters)); }
    catch { setMessage("A böngésző tárhelye megtelt; a karakter módosítása nem lett elmentve."); }
  }, [characters, ready]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem("wonderly-live-duo-v1", JSON.stringify({scene, voices:castVoices})); }
    catch { setMessage("A jelenet hangbeállításai nem lettek elmentve."); }
  }, [ready, scene, castVoices]);
  useEffect(() => { channel.current?.postMessage({type:"state", state}); }, [character.name, character.image, caption, isSpeaking, motion.frame, emotion, connected, activeTrack?.title, scene, speaker, effect]);
  useEffect(() => { if (music.current) music.current.volume = isSpeaking ? volume * 0.2 : volume; }, [isSpeaking, volume, currentTrack]);

  function update(fieldName: "name" | "personality" | "voiceId" | "voiceName", value: string) {
    setCharacters(current => current.map(c => c.id === character.id ? {...c, [fieldName]:value} : c));
  }
  function pause() { autoRef.current = false; setAuto(false); operation.current?.abort(); setEffect(undefined); }
  function stopAll() { setAvatarStop(n => n + 1); pause(); queue.current.clear(); setPending([]); music.current?.pause(); setCurrentTrack(""); setCaption("A műsor szünetel."); setEmotion("neutral"); }
  function addLog(log: Log) { history.current = [...history.current, log].slice(-30); setLogs(history.current); }
  async function manualSpeech(role?: Speaker) {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage(""); setSpeaker(role); setEffect(undefined); setEmotion("neutral");
    const line = role === "ali" ? "Szia! Ali vagyok, a boszorkány. Isti, készülj egy kis varázslatra!" : role === "isti" ? "Szia! Isti vagyok. Ali, hagyj már békén ebben a székben!" : text;
    setCaption(line);
    try { if (voiceMode === "eleven") await speech.unlock(); await speech.say(line, voiceMode, role ? castVoices[role] : character.voiceId, controller.signal); }
    catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Hanghiba"); }
    finally { operation.current = null; setBusy(false); if (autoRef.current) void processRef.current(); }
  }
  async function speakDialogue(dialogue: Dialogue, event: LiveEvent, signal: AbortSignal) {
    let first = true;
    setEffect(undefined);
    await playDialogue(dialogue, castVoices, voiceMode, signal, async (turn, voiceId) => {
      const onStart=()=>{setSpeaker(turn.speaker);setCaption(turn.text);setEmotion(turn.emotion);if(first){first=false;setEffect(giftEffect(event));}};
      if(motionMode && voiceMode==="eleven") await motion.say(turn,voiceId,signal,onStart);
      else await speech.say(turn.text,voiceMode,voiceId,signal,onStart);
    });
  }
  async function demoScene() {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage("");
    const event: LiveEvent = {id:crypto.randomUUID(), type:"gift", user:"Próbanéző", text:"", gift:testGift, count:1};
    try { if (voiceMode === "eleven") await speech.unlock(motionMode ? motion.element.current : speech.element.current); await speakDialogue(rehearsalDialogue(event), event, controller.signal); }
    catch (e) { setEffect(undefined); if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Jelenethiba"); }
    finally { operation.current = null; setBusy(false); }
  }
  async function previewAI(play = false) {
    if (operation.current || auto) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage(""); setAIPreview(null);
    try {
      if (play && voiceMode === "eleven") await speech.unlock(motionMode ? motion.element.current : speech.element.current);
      controller.signal.throwIfAborted();
      const event: LiveEvent = {id:crypto.randomUUID(), type:"comment", user:testUser.trim(), text:testText.trim(), count:1};
      const recent = history.current.filter(l => !l.error && l.source === "ai").slice(-8).map(l => ({user:l.event.user, text:l.event.text || l.event.gift || "", reply:l.reply.slice(0,520)}));
      const response = await fetch("/api/live-studio/dialogue", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({event, history:recent}), signal:controller.signal});
      const dialogue = dialogueSchema.parse(await readAIResponse(response));
      controller.signal.throwIfAborted(); setAIPreview(dialogue);
      if (play) {
        await speakDialogue(dialogue, event, controller.signal);
        addLog({event, reply:dialogue.turns.map(turn => `${CAST[turn.speaker].name}: ${turn.text}`).join(" · "), source:"ai"});
        replyCount.current++; setReplies(replyCount.current);
        setMessage("Az egyszeri AI-kommentpróba befejeződött. Mindkét szereplő válasza lejátszódott.");
      }
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "AI-hiba"); }
    finally { operation.current = null; setBusy(false); }
  }
  async function processNext() {
    if (operation.current || !autoRef.current) return;
    if (replyCount.current >= limit) { autoRef.current = false; setAuto(false); setMessage("Elérted az adás válaszkorlátját. A folytatáshoz növeld a korlátot."); return; }
    const event = queue.current.take(); setPending(queue.current.snapshot());
    if (!event) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage("");
    try {
      let spoken: string;
      const recent = history.current.filter(l => !l.error && l.source === "ai").slice(-8).map(l => ({user:l.event.user, text:l.event.text || l.event.gift || "", reply:l.reply.slice(0,520)}));
      const requested = event.type === "comment" ? songRequest(event.text) : null;
      let started = false;
      if (requested) {
        const matches = tracks.filter(track => normalize(track.title) === normalize(requested));
        started = autoMusic && matches.length === 1 ? await playTrack(matches[0]) : false;
      }
      if (scene === "duo") {
        let dialogue: Dialogue;
        if (mode === "rehearsal") dialogue = rehearsalDialogue(event, started);
        else {
          const response = await fetch("/api/live-studio/dialogue", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({event, history:recent, music:requested ? {requested, started} : undefined}), signal:controller.signal});
          dialogue = dialogueSchema.parse(await readAIResponse(response));
        }
        await speakDialogue(dialogue, event, controller.signal);
        spoken = dialogue.turns.map(turn => `${CAST[turn.speaker].name}: ${turn.text}`).join(" · ");
      } else {
        let reply: Reply;
        if (requested && mode === "rehearsal") reply = started ? {text: `${event.user}, indul a kért dal!`, emotion: "happy"} : rehearsalReply(event);
        else if (mode === "rehearsal") reply = rehearsalReply(event);
        else {
          const response = await fetch("/api/live-studio/reply", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({event, character:{name:character.name, personality:character.personality}, history:recent.slice(-6).map(h => ({...h, reply:h.reply.slice(0,350)})), music:requested ? {requested, started} : undefined}), signal:controller.signal});
          reply = replySchema.parse(await readAIResponse(response));
        }
        controller.signal.throwIfAborted(); setSpeaker(undefined); setCaption(reply.text); setEmotion(reply.emotion);
        await speech.say(reply.text, voiceMode, character.voiceId, controller.signal);
        spoken = reply.text;
      }
      addLog({event, reply:spoken, source:mode}); replyCount.current++; setReplies(replyCount.current);
    } catch (e) {
      setEffect(undefined);
      addLog({event, reply:controller.signal.aborted ? "Megszakítva" : e instanceof Error ? e.message : "Válaszhiba", error:true});
      if (!controller.signal.aborted) { setMessage(e instanceof Error ? e.message : "Válaszhiba"); autoRef.current = false; setAuto(false); }
    } finally {
      operation.current = null; setBusy(false);
      if (autoRef.current) void processRef.current();
    }
  }
  processRef.current = processNext;
  function enqueue(event: LiveEvent) {
    if (!queue.current.add(event)) { setDropped(queue.current.dropped); return; }
    const requested = event.type === "comment" ? songRequest(event.text) : null;
    if (requested) setRequests(current => [...current, {user:event.user, title:requested}].slice(-30));
    setPending(queue.current.snapshot());
    if (autoRef.current) void processRef.current();
  }
  enqueueRef.current = enqueue;
  async function toggleAuto() {
    if (autoRef.current) { pause(); return; }
    if (operation.current) return;
    if (mode === "ai" && !service?.ai) { setMessage("Az AI-válaszadó még nem érhető el. A válaszadás nem indult el."); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); autoRef.current = true; setAuto(true);
    try { if (voiceMode === "eleven") await speech.unlock(motionMode && scene === "duo" ? motion.element.current : speech.element.current); controller.signal.throwIfAborted(); }
    catch { autoRef.current = false; setAuto(false); if (!controller.signal.aborted) setMessage("A böngésző nem engedte a hang indítását. Ellenőrizd az oldal hangengedélyét."); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); } }
    if (autoRef.current) void processRef.current();
  }
  async function loadVoices() {
    setLoadingVoices(true); setMessage(""); const characterId = character.id;
    try {
      const r = await fetch("/api/live-studio/voices"); if (!r.ok) throw new Error("A hanglista nem elérhető; ellenőrizd a bejelentkezést és az ElevenLabs-kapcsolatot.");
      const data = await r.json(); setAccountVoices(data.voices);
      if (scene === "duo") { setMessage("A hanglista betöltve. Ali és Mc Isti hangját külön választhatod ki."); return; }
      const matches = data.voices.filter((v:{name:string}) => v.name.trim().toLowerCase() === (character.voiceName || "").trim().toLowerCase());
      if (matches.length === 1) { setCharacters(current => current.map(c => c.id === characterId ? {...c, voiceId:matches[0].id} : c)); setMessage(`${matches[0].name} hang kiválasztva.`); }
      else setMessage("Válaszd ki a karakter hangját a listából.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Hanglista hiba"); } finally { setLoadingVoices(false); }
  }
  function connect() {
    if (!/^[a-zA-Z0-9_.]{2,32}$/.test(username.replace(/^@/, "")) || !pairing.trim()) { setMessage("Add meg a TikTok felhasználónevet és az összekötő párosítási kódját."); return; }
    socket.current?.close(); setConnected(false); setBridgeStatus("Kapcsolódás…");
    const ws = new WebSocket("ws://127.0.0.1:21214"); socket.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({type:"connect", username:username.replace(/^@/, ""), token:pairing.trim()}));
    ws.onmessage = ({data}) => {
      if (socket.current !== ws || typeof data !== "string" || data.length > 10000) return;
      try {
        const value = JSON.parse(data);
        if (value.type === "status") { setConnected(value.connected === true); setBridgeStatus(String(value.message || "").slice(0, 200)); }
        if (value.type === "event") { const parsed = eventSchema.safeParse(value.event); if (parsed.success) enqueueRef.current(parsed.data); }
      } catch { /* Untrusted bridge frames are ignored. */ }
    };
    ws.onclose = () => { if (socket.current === ws) { setConnected(false); setBridgeStatus("Kapcsolat megszakadt. Az újracsatlakozást kézzel indíthatod."); } };
    ws.onerror = () => { if (socket.current === ws) setBridgeStatus("Az összekötő nem érhető el. Indítsd el ugyanazon a számítógépen, és engedélyezd a helyi kapcsolatot a böngészőben."); };
  }
  async function playTrack(track: Track): Promise<boolean> {
    setCurrentTrack(track.id);
    const player = music.current; if (!player) return false;
    player.src = track.url; player.volume = isSpeaking ? volume * 0.2 : volume;
    try { await player.play(); return true; } catch { setMessage("A zenét a lejátszó indítógombjával indítsd el."); return false; }
  }

  return <div className="space-y-6 pb-12">
    <header className="flex flex-wrap justify-between items-center gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-amber-400">WonderlyTales</p><h1 className="text-3xl font-bold">Élő karakterstúdió</h1><p className="mt-2 text-zinc-400">Magyar műsorvezető • Kommentek és ajándékok • Zenekérések</p></div><button className="rounded-lg bg-red-700 px-4 py-3 text-white font-bold" onClick={stopAll}>Mindent leállít</button></header>
    <div className="rounded-xl border border-amber-700/70 bg-amber-950/20 p-4 text-sm text-amber-100">Ali és Mc Isti minden kommentre új AI-párbeszédet készít. Runway-módban a saját hangjukból beszélő videó készül, amely az adásképben is megjelenik. A generálásra várni kell; a válaszok sorban hangzanak el. Az adáskép megnyitása nem indít TikTok-közvetítést.</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,380px)_1fr]">
      <aside className="space-y-4"><Stage state={state} /><button className={`${button} w-full`} onClick={() => {const popup = window.open(`/live-studio/output#${outputId.current}`, "wonderly-live-output", "width=540,height=960"); if (!popup) setMessage("Engedélyezd a felugró ablakot az adáskép megnyitásához.");}}>Tiszta adáskép külön ablakban ↗</button><p className="text-xs text-zinc-400">A LIVE Studio az adáskép ablakát rögzítse. A hang a vezérlő stúdiófülön szól; ezt hagyd nyitva.</p><div className={panel}><h2 className="font-semibold">Állapot</h2><p className="text-sm">AI: {service ? service.ai ? `beállítva (${service.aiModel || "AI"})` : "nincs beállítva" : "ellenőrzés…"}<br/>ElevenLabs: {service ? service.voice ? "beállítva" : "nincs beállítva" : "ellenőrzés…"}<br/>TikTok: {bridgeStatus}<br/>Elhangzott válasz: {replies} / {limit}<br/>Várakozó: {pending.length}{dropped > 0 && <><br/>Torlódás miatt kihagyva: {dropped}</>}</p>{speech.timed && <p className="text-xs text-emerald-300">Beszédidőzítés rendelkezésre áll{speech.word ? ` • ${speech.word}` : ""}</p>}</div></aside>
      <div className="space-y-5">
        <section className={panel}><h2 className="text-xl font-semibold">Műsorjelenet</h2>
          <label className="flex items-center gap-2"><input type="checkbox" checked={motionMode} disabled={busy || auto || scene!=="duo" || voiceMode!=="eleven" || !service?.motion?.configured} onChange={e=>setMotionMode(e.target.checked)} />Runway beszélő videó a kommentekhez</label>
          <p className="text-xs text-zinc-400">{service?.motion?.configured ? "Mindkét karakter bekötve." : "A videómódhoz mindkét Runway-karakter beállítása szükséges."} Egy megszólalás legfeljebb 30 másodperc; legfeljebb 12 Runway API-kredit, plusz a saját hang költsége. Egy kétfős válasz legfeljebb 24 kredit. A Runway webes Pro-kerete külön egyenleg. A készülő videó leállítható, de a már elindított generálás díja megmaradhat.</p>
          {motion.status && <p role="status" className="text-sm text-violet-300">{motion.status}</p>}
          <label className="block">Jelenet<select className={field} disabled={busy || auto} value={scene} onChange={e => {pause(); setScene(e.target.value as "solo" | "duo"); setSpeaker(undefined); history.current=[]; setLogs([]); setCaption("Kezdődhet a műsor!");}}><option value="duo">Ali boszorkány és a duzzogó Mc Isti</option><option value="solo">Egyszereplős karakter</option></select></label>
          {scene === "duo" && <><p className="text-sm text-zinc-300">Ali csípős poénokkal ugratja Pukkancsot. Isti felkapja a vizet, aztán önironikusan visszakozik. A jelmez marad, a beszéd hétköznapi trash-komédia. A két hang egymás után szólal meg.</p><p className="text-xs text-zinc-400">Rózsa → rózsaszirmok · Szív → szívecskék · Más ajándék → zöld varázsköd</p><button className={button} disabled={busy || auto} onClick={() => void demoScene()}>Technikai hangpróba – rögzített tesztszöveg</button><button className="ml-2 rounded-lg border border-violet-400 px-4 py-2 text-sm disabled:opacity-40" disabled={busy || auto} onClick={() => {setSpeaker(undefined); setCaption("Varázseffekt próba – hang nélkül."); setEffect(giftEffect({id:crypto.randomUUID(),type:"gift",user:"Próbanéző",text:"",gift:testGift,count:1}));}}>Varázseffekt próba hang nélkül</button></>}
        </section>
        {scene === "solo" && <section className={panel}><h2 className="text-xl font-semibold">Az adás karaktere</h2>
          <div className="flex gap-2"><select aria-label="Karakter" className={field} disabled={busy || auto} value={character.id} onChange={e => { pause(); history.current=[]; setLogs([]); setSelected(e.target.value); setCaption("Üdv a műsorban!"); }}>{characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className={button} disabled={busy || auto} onClick={() => { const id=crypto.randomUUID(); setCharacters(c=>[...c,{...INITIAL,id,name:"Új karakter",voiceId:undefined,voiceName:""}]); setSelected(id); history.current=[]; setLogs([]); }}>Új</button></div>
          <label className="block">Név<input className={field} disabled={busy || auto} maxLength={80} value={character.name} onChange={e=>update("name",e.target.value)} /></label>
          <label className="block">Személyiség<textarea className={field} disabled={busy || auto} maxLength={2000} value={character.personality} onChange={e=>update("personality",e.target.value)} /></label>
          <label className="block text-sm">Karakterkép (PNG, JPG, WebP; legfeljebb 2 MB)<input className="block mt-2" disabled={busy || auto} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0]; if(!file)return; if(file.size>2097152 || !["image/png","image/jpeg","image/webp"].includes(file.type)){setMessage("Legfeljebb 2 MB méretű PNG, JPG vagy WebP kép szükséges.");return;}const id=character.id;const reader=new FileReader();reader.onerror=()=>setMessage("A kép nem olvasható.");reader.onload=()=>setCharacters(c=>c.map(item=>item.id===id?{...item,image:String(reader.result)}:item));reader.readAsDataURL(file);}} /></label><p className="text-xs text-zinc-400">A karakterek ezen a böngészőn maradnak meg.</p>
        </section>}
        <section className={panel}><h2 className="text-xl font-semibold">{scene === "duo" ? "Ali és Mc Isti hangja" : "A karakter hangja"}</h2>
          <label className="block">Hangforrás<select className={field} disabled={busy || auto} value={voiceMode} onChange={e=>setVoiceMode(e.target.value as "eleven" | "browser")}><option value="eleven">ElevenLabs – saját karakterhang</option><option value="browser">Magyar böngészőhang – díjmentes próba</option></select></label>
          {scene === "duo" ? <><div className="flex items-center justify-between gap-3"><p className="text-xs text-zinc-400">{voiceMode === "browser" ? "A böngészős próbában mindkét szereplő ugyanazt a magyar rendszerhangot használja." : "A saját ElevenLabs-fiókodban ellenőrzött hangok."}</p><button className={button} disabled={loadingVoices || busy || auto} onClick={() => void loadVoices()}>{loadingVoices ? "Betöltés…" : "Hanglista"}</button></div><DuoVoices voices={castVoices} options={accountVoices} disabled={busy || auto} onChange={(role,id) => setCastVoices(current => ({...current, [role]:id}))} onTest={role => void manualSpeech(role)} /></> : <>
          <div className="flex gap-2"><input aria-label="Keresett ElevenLabs-hang neve" className={field} disabled={busy || auto} placeholder="ElevenLabs-hang neve" maxLength={100} value={character.voiceName || ""} onChange={e=>update("voiceName",e.target.value)} /><button className={button} disabled={loadingVoices || busy || auto} onClick={()=>void loadVoices()}>{loadingVoices?"Betöltés…":"Hanglista"}</button></div>
          {accountVoices.length>0 && <select aria-label="ElevenLabs hang" className={field} disabled={busy || auto} value={character.voiceId || ""} onChange={e=>{update("voiceId",e.target.value);const v=accountVoices.find(v=>v.id===e.target.value);if(v)update("voiceName",v.name);}}><option value="">Válassz hangot</option>{accountVoices.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select>}
          <label className="block text-sm">Voice ID<input className={field} disabled={busy || auto} maxLength={100} value={character.voiceId || ""} onChange={e=>update("voiceId",e.target.value.replace(/[^a-zA-Z0-9]/g,""))} /></label>
          <label className="block">Próbaszöveg<textarea className={field} maxLength={1000} value={text} onChange={e=>setText(e.target.value)} /></label><button className={button} disabled={busy || auto || !text.trim()} onClick={()=>void manualSpeech()}>Hangpróba</button></>}<p className="text-xs text-zinc-400">Az ElevenLabs az eddig beállított stúdiókeretet használja. Egy szöveghez egy hangkészítési kísérlet tartozik.</p>
        </section>
        <section className={panel}><h2 className="text-xl font-semibold">Kommentek és ajándékok</h2>
          <div className="grid gap-3 sm:grid-cols-2"><label>Válaszmód<select className={field} disabled={busy || auto} value={mode} onChange={e=>setMode(e.target.value as "ai" | "rehearsal")}><option value="ai">AI – élő, kommentre épülő párbeszéd</option><option value="rehearsal">Hangteszt – előre megírt próbaszövegek</option></select></label><label>Válaszkorlát ebben az adásban<input className={field} type="number" min={1} max={500} value={limit} onChange={e=>setLimit(Math.max(1,Math.min(500,Number(e.target.value)||1)))} /></label></div>
          <button className={button} disabled={!auto && (busy || (mode === "ai" && !service?.ai) || (voiceMode==="eleven" && (scene === "duo" ? !castVoices.ali || !castVoices.isti : !character.voiceId)))} onClick={toggleAuto}>{auto?"Válaszadás szüneteltetése":"Automatikus válaszadás indítása"}</button>
          <p className="text-xs text-zinc-400">AI-módban Ali az aktuális kommentre csipkelődő poénnal válaszol, Isti előbb felháborodik, aztán önironikusan beadja a derekát. Az utolsó nyolc AI-párbeszédre emlékeznek. A válaszok érkezési sorrendben hangzanak el. A válasz szövege {service?.aiProvider === "wavespeed" ? "WaveSpeed-kérést használ (0,01 USD / kérés)" : service?.aiProvider === "gateway" ? "a Vercel AI Gateway keretét használja" : "a beállított AI-szolgáltató keretét használja"}. Ez külön keret a Runway-kreditektől. A közös jelenetben egy válasz két megszólalásból áll, így két hangkészítést használ. Hiba esetén a sor megáll. A próbamód előre megírt szöveget használ; ElevenLabs választásakor a hangkészítés ebben a módban is keretet fogyaszt.</p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]"><input aria-label="Próbanéző neve" className={field} value={testUser} maxLength={80} onChange={e=>setTestUser(e.target.value)} /><input aria-label="Próbakomment" className={field} value={testText} maxLength={500} onChange={e=>setTestText(e.target.value)} /></div>
          {scene === "duo" && <div className="space-y-2"><div className="flex flex-wrap gap-2"><button className={button} disabled={busy || auto || !service?.ai || !testUser.trim() || !testText.trim()} onClick={() => void previewAI()}>AI-kommentpróba hang nélkül</button><button className={button} disabled={busy || auto || !service?.ai || !testUser.trim() || !testText.trim() || (voiceMode === "eleven" && (!service?.voice || !castVoices.ali || !castVoices.isti)) || (motionMode && !service?.motion?.configured)} onClick={() => void previewAI(true)}>{motionMode && voiceMode === "eleven" ? "Egyszeri AI-videópróba" : "Egyszeri AI-hangpróba"}</button></div><p className="text-xs text-zinc-400">Mindkét próba új választ ír a kommentre. A hang nélküli próba csak szöveget készít. Az egyszeri lejátszás a kiválasztott hangot és videómódot használja, két megszólalás után megáll. Videómódban a generálásra várni kell; ez még nem azonnali élő mozgás.</p>{aiPreview && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 space-y-2">{aiPreview.turns.map(turn => <p key={turn.speaker}><strong>{CAST[turn.speaker].name}:</strong> {turn.text}</p>)}</div>}</div>}
          <label className="block text-sm">Próbaajándék típusa<select className={field} value={testGift} onChange={e=>setTestGift(e.target.value)}><option value="rózsa">Rózsa – szirmok</option><option value="szív">Szív – szívecskék</option><option value="varázspálca">Varázspálca – zöld köd</option></select></label>
          <div className="flex flex-wrap gap-2"><button className={button} disabled={!testUser.trim() || !testText.trim()} onClick={()=>enqueue({id:crypto.randomUUID(),type:"comment",user:testUser.trim(),text:testText.trim(),count:1})}>Próbakomment</button><button className={button} disabled={!testUser.trim()} onClick={()=>enqueue({id:crypto.randomUUID(),type:"gift",user:testUser.trim(),text:"",gift:testGift,count:1})}>Próbaajándék</button><button className="rounded-lg border border-zinc-600 px-3" onClick={()=>{queue.current.clear();setPending([]);}}>Várakozók törlése</button></div>
          {pending.length>0 && <div className="max-h-40 overflow-auto space-y-1 text-sm">{pending.map(e=><p key={e.id}><strong>{e.user}</strong>: {e.type==="gift"?`🎁 ${e.count} ${e.gift}`:e.text}</p>)}</div>}
          {logs.length>0 && <details><summary className="cursor-pointer">Elhangzott válaszok és hibák ({logs.length})</summary><div className="max-h-64 overflow-auto space-y-3 mt-2">{[...logs].reverse().map((l,i)=><div key={`${l.event.id}-${i}`} className={`rounded-lg p-3 text-sm ${l.error?"bg-red-950/40":"bg-zinc-900"}`}><strong>{l.event.user}</strong>: {l.event.text || l.event.gift}<p className="mt-1 text-zinc-300">{l.reply}</p>{l.error && <button className="text-amber-300 mt-2" onClick={()=>enqueue({...l.event,id:crypto.randomUUID()})}>Újrapróbálás a sorban</button>}</div>)}</div></details>}
        </section>
        <section className={panel}><h2 className="text-xl font-semibold">TikTok-kommentkapcsolat</h2><p className="text-sm text-zinc-400">Az összekötő ugyanazon a számítógépen fusson, ahol ez a stúdió nyitva van. Aktív TikTok LIVE-adást olvas; közvetítést nem indít.</p><label className="block">TikTok felhasználónév<input className={field} placeholder="@felhasznalonev" maxLength={33} value={username} onChange={e=>setUsername(e.target.value)} /></label><label className="block">Összekötő párosítási kódja<input className={field} type="password" autoComplete="off" value={pairing} onChange={e=>setPairing(e.target.value)} /></label><div className="flex gap-2"><button className={button} onClick={connect}>Kapcsolódás</button><button className={button} onClick={()=>{socket.current?.close();setConnected(false);}}>Bontás</button></div><p role="status" className="text-sm">{bridgeStatus}</p><a className="text-sm text-amber-300 underline" href="https://github.com/moldovansandor1998-ai/Wonderlytales/tree/main/tools/tiktok-bridge" target="_blank" rel="noreferrer">Összekötő és indítási útmutató ↗</a></section>
        <section className={panel}><h2 className="text-xl font-semibold">Zene és kívánságlista</h2><label className="block">Saját, közvetítésre jogosított zenék<input className="block mt-2" type="file" accept="audio/*" multiple onChange={e=>{const files=Array.from(e.target.files || []);const added=files.filter(f=>f.size<=100*1024*1024).slice(0,30).map(f=>{const url=URL.createObjectURL(f);objectUrls.current.add(url);return{id:crypto.randomUUID(),title:f.name.replace(/\.[^.]+$/,""),url};});setTracks(t=>[...t,...added]);}} /></label><label className="block">Hangerő<input className="block w-full" type="range" min={0} max={1} step={0.05} value={volume} onChange={e=>setVolume(Number(e.target.value))} /></label><p className="text-xs text-zinc-400">Beszéd közben a zene a beállított hangerő ötödére halkul. A nézők így kérhetnek számot: !zene számcím. A pontosan egyező című, előre betöltött szám automatikusan indulhat. A zenefájlok az oldal bezárásáig maradnak betöltve.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoMusic} onChange={e=>setAutoMusic(e.target.checked)} />Pontos címre érkező zenekérések automatikus lejátszása</label>{tracks.map(t=><button key={t.id} className="mr-2 rounded-lg border border-zinc-600 px-3 py-2 text-sm" onClick={()=>playTrack(t)}>▶ {t.title}</button>)}{requests.length>0 && <div className="space-y-2">{requests.map((r,i)=>{const matches=tracks.filter(t=>normalize(t.title)===normalize(r.title));return <div key={`${r.user}-${i}`} className="flex gap-2 items-center rounded-lg bg-zinc-900 p-2 text-sm"><span className="flex-1">{r.user}: {r.title}</span>{matches.length===1?<button className="text-amber-300" onClick={()=>playTrack(matches[0])}>Lejátszás</button>:<span className="text-zinc-500">Válassz zenét a listából</span>}</div>;})}</div>}<audio ref={music} controls className="w-full" onEnded={()=>setCurrentTrack("")} /></section>
        <MotionHistory disabled={busy || auto} stopSignal={avatarStop} />
        <AvatarPreview configuration={service?.avatar} disabled={speechBusy || auto} stopSignal={avatarStop} onActive={active => {setAvatarTesting(active); if (active) {pause(); music.current?.pause(); setCurrentTrack("");}}} />
        <section className={panel}><h2 className="text-xl font-semibold">Adás indítása</h2><ol className="list-decimal pl-5 space-y-2 text-sm"><li>Válassz karaktert és hangot, majd próbáld ki a felolvasást.</li><li>Nyisd meg a tiszta adásképet; a vezérlő stúdió maradjon nyitva.</li><li>A TikTok LIVE Studio alkalmazásban állíts be 9:16 képet, az adáskép ablakának rögzítését és a géphangot.</li><li>A LIVE Studio alkalmazásból indítsd el az adást. Ezután csatlakoztasd a kommentfigyelőt és indítsd az automatikus válaszadást.</li></ol></section>
      </div>
    </div>
    {message && <div role="status" className="sticky bottom-3 rounded-xl border border-amber-600 bg-zinc-950 p-4 text-amber-200">{message}<button className="float-right ml-4" aria-label="Üzenet bezárása" onClick={()=>setMessage("")}>×</button></div>}
    <video ref={motion.element} playsInline className="hidden" /><audio ref={speech.element} className="hidden" />
  </div>;
}
