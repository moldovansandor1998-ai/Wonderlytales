"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { replySchema, EventQueue, rehearsalReply, songRequest, type LiveEvent, type Reply, type Emotion, isBigGift } from "@/lib/live/events";
import { GiftPriority } from "@/lib/live/gift-priority";
import { readAIResponse } from "@/lib/live/client";
import type { StageState } from "@/lib/live/stage";
import Stage from "./Stage";
import DuoVoices from "./DuoVoices";
import { CAST, DUO_IMAGE, dialogueSchema, giftEffect, playDialogue, rehearsalDialogue, giftDialogue, type CastVoices, type Dialogue, type GiftEffect, type Speaker } from "@/lib/live/duo";
import { useMotion } from "./useMotion";
import { useNpc } from "./useNpc";
import { useMusicBed } from "./useMusicBed";
import { useDjMusic } from "./useDjMusic";
import MusicPanel from "./MusicPanel";
import { DJ_MOODS, type MusicTrack } from "@/lib/live/dj";
import type { NpcPlayback } from "./NpcPlayer";
import type { MotionFrame } from "./useMotion";
import { useGagSound } from "./useGagSound";
import { NPC_IMAGE, DEFAULT_MUSIC_GIFTS, GAG_KINDS, GAG_META, GiftGagPicker, availableGiftGag, type GagKind, type NpcOperation, isMusicGift } from "@/lib/live/npc-shared";
import MotionHistory, { type Clip } from "./MotionHistory";
import { useMobileStage } from "./useMobileStage";
import { useTikTokConnection, type ConnectionMode } from "./useTikTokConnection";
import AvatarPreview from "./AvatarPreview";
import { useSpeech } from "./useSpeech";

type Character = { id: string; name: string; personality: string; image: string; voiceId?: string; voiceName?: string };
type Log = { event: LiveEvent; reply: string; source?: "ai" | "rehearsal" | "saved"; error?: boolean };
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
  const npc = useNpc();
  const npcPlayer=useRef<NpcPlayback>(null);
  const [npcFrame,setNpcFrame]=useState<MotionFrame>();
  const [musicGiftNames,setMusicGiftNames]=useState(DEFAULT_MUSIC_GIFTS);
  const [musicGiftId,setMusicGiftId]=useState("");
  const mobile = useMobileStage();
  const [motionMode,setMotionMode]=useState(false);
  const [continuous,setContinuous]=useState(false);
  const [backdropActive,setBackdropActive]=useState(false);
  const continuousRef=useRef(false);
  const trialRemaining=useRef<number|null>(null);
  const trialGiftTimer=useRef<ReturnType<typeof setTimeout>>();
  const isSpeaking=speech.speaking || motion.speaking;
  const operation = useRef<AbortController | null>(null);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const queue = useRef(new EventQueue({maxComments:2, commentMaxAgeMs:10000, coalesceGifts:true}));
  const giftPriority = useRef(new GiftPriority());
  const [pending, setPending] = useState<LiveEvent[]>([]);
  const [dropped, setDropped] = useState(0);
  const [logs, setLogs] = useState<Log[]>([]);
  const history = useRef<Log[]>([]);
  const previewHistory = useRef<{user:string;text:string;reply:string}[]>([]);
  const silentPreviewCount = useRef(0);
  const [replies, setReplies] = useState(0);
  const [limit, setLimit] = useState(100);
  const replyCount = useRef(0);
  const processRef = useRef<() => Promise<void>>(async () => {});
  const [testGift, setTestGift] = useState("rózsa");
  const [testGiftValue,setTestGiftValue]=useState(1);
  const [testGiftCount,setTestGiftCount]=useState(1);
  const giftReplyCount=useRef(0),gagPicker=useRef(new GiftGagPicker());
  const gagSound=useGagSound();
  const [previewGag,setPreviewGag]=useState<GagKind|"random">("random");
  const retryQueueTimer=useRef<ReturnType<typeof setTimeout>>();
  const replyStartedAt=useRef(0);
  const [firstAudioMs,setFirstAudioMs]=useState<number>();
  const [testUser, setTestUser] = useState("Próbanéző");
  const [testText, setTestText] = useState("Ali, miért duzzog már megint Isti?");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("cloud");
  const [username, setUsername] = useState("");
  const [pairing, setPairing] = useState("");
  const enqueueRef = useRef<(event: LiveEvent) => void>(() => {});
  const tiktok = useTikTokConnection(event => enqueueRef.current(event), reason => {
    pause(false); setMessage(reason); setSpeaker(undefined);
    setCaption("Ali és Isti várják a kommentkapcsolatot."); mobile.setControls(true);
  });
  const connected = tiktok.connected, bridgeStatus = tiktok.status;
  const [requests, setRequests] = useState<{user:string; title:string}[]>([]);
  const [volume, setVolume] = useState(0.35);
  const [autoMusic, setAutoMusic] = useState(true);
  const [backgroundMusic,setBackgroundMusic]=useState(true);
  const dj=useDjMusic(volume,isSpeaking,setMessage);
  const tracks=dj.tracks, activeTrack=dj.current;
  const musicBed=useMusicBed(volume,isSpeaking,backgroundMusic&&!activeTrack,dj.mood,dj.adaptive&&(backgroundMusic||!!activeTrack));
  const channel = useRef<BroadcastChannel | null>(null);
  const outputId = useRef("");
  const state: StageState = {name:scene === "duo" ? "Ali és Mc Isti" : character.name, image:scene === "duo" ? continuous ? NPC_IMAGE : DUO_IMAGE : character.image, caption, speaking:isSpeaking, emotion, connected, song:activeTrack?.title || (continuous&&musicBed.playing&&backgroundMusic?`DJ • ${DJ_MOODS[dj.mood].label}`:""), scene, speaker, effect, motion:motion.frame, npc:continuous&&npc.assets?{frame:npcFrame,active:backdropActive}:undefined, showStatus:continuous ? auto ? busy ? "Készül a következő válasz…" : connected ? "A műsor fut • Kommenteket és ajándékokat figyelünk" : "Alapvideó fut • TikTok-kapcsolódás / próba" : busy ? "A műsor előkészítése…" : backdropActive ? "Alapvideó fut • Automatikus válaszadás szünetel" : "A műsor szünetel" : undefined};
  const stageRef = useRef(state); stageRef.current = state;

  useEffect(() => {
    try {
      setUsername(localStorage.getItem("wonderly-live-username-v1") || "");
      const giftSettings=JSON.parse(localStorage.getItem("wonderly-live-music-gift-v1")||"null");
      if(typeof giftSettings?.names==="string")setMusicGiftNames(giftSettings.names.slice(0,400));
      if(typeof giftSettings?.id==="string"&&/^\d{0,30}$/.test(giftSettings.id))setMusicGiftId(giftSettings.id);
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
    return () => { controller.abort(); autoRef.current = false; operation.current?.abort(); clearTimeout(retryQueueTimer.current); clearTimeout(trialGiftTimer.current); clearInterval(heartbeat); c.close(); };
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
  useEffect(() => { if (ready) { try { localStorage.setItem("wonderly-live-username-v1",username); } catch { /* The current session can still run without persistent settings. */ } } }, [ready,username]);
  useEffect(() => { channel.current?.postMessage({type:"state", state}); }, [character.name, character.image, caption, isSpeaking, motion.frame, emotion, connected, activeTrack?.title, scene, speaker, effect, continuous, npcFrame, npc.assets, backdropActive, auto, busy, backgroundMusic, musicBed.playing, dj.mood]);
  useEffect(()=>{if(ready){try{localStorage.setItem("wonderly-live-music-gift-v1",JSON.stringify({names:musicGiftNames,id:musicGiftId}));}catch{}}},[ready,musicGiftNames,musicGiftId]);

  async function replayOnStage(clip: Clip) {
    if (operation.current || auto || !clip.url) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage("");
    setSpeaker(clip.speaker); setCaption(clip.text || "Mentett karakterpróba"); setEffect(undefined);
    mobile.open();
    try { await motion.play(clip.url, clip.requestId, controller.signal); }
    catch (error) { if (!controller.signal.aborted) { setMessage(error instanceof Error ? error.message : "Lejátszási hiba"); mobile.setControls(true); } }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); } }
  }

  function update(fieldName: "name" | "personality" | "voiceId" | "voiceName", value: string) {
    setCharacters(current => current.map(c => c.id === character.id ? {...c, [fieldName]:value} : c));
  }
  function pause(stopBackdrop=true) { autoRef.current = false; setAuto(false); if(stopBackdrop){setBackdropActive(false);musicBed.stop();dj.stop();} operation.current?.abort(); clearTimeout(retryQueueTimer.current); clearTimeout(trialGiftTimer.current); trialRemaining.current=null; setEffect(undefined); }
  function stopAll() { tiktok.disconnect(); setAvatarStop(n => n + 1); pause(); queue.current.clear(); setPending([]); dj.stop(); setCaption("A műsor szünetel."); setEmotion("neutral"); }
  function addLog(log: Log) { history.current = [...history.current, log].slice(-30); setLogs(history.current); }
  const onBackdropError=useCallback((reason:string)=>{
    autoRef.current=false;setAuto(false);setBackdropActive(false);operation.current?.abort();clearTimeout(trialGiftTimer.current);
    musicBed.stop();dj.stop();setMessage(reason);
  },[]);
  async function previewBackdrop(prepare=false) {
    if(operation.current||autoRef.current)return;
    const controller=new AbortController();operation.current=controller;setBusy(true);setMessage("");
    setContinuous(true);continuousRef.current=true;setScene("duo");setMotionMode(false);setSpeaker(undefined);
    try {
      await Promise.all([speech.unlock(),musicBed.unlock(), dj.unlock(),gagSound.unlock()]);
      await npc.ensure(castVoices.isti,controller.signal,prepare);controller.signal.throwIfAborted();
      setBackdropActive(true);musicBed.start();dj.start();setCaption("Ali figyel, Isti duzzog. A zene folyamatosan változik.");
      setMessage(prepare?"Az alapjelenetek, a hat kevert geg, a Galaxis és a nagyjelenetek elmentve.":"Mentett NPC-műsor és háttérzene • nincs új generálás");
      if(!prepare)mobile.open();
    } catch(error) { if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"Az NPC-jelenetek nem érhetők el.");musicBed.stop(); }
    finally { if(operation.current===controller){operation.current=null;setBusy(false);} }
  }
  async function inspectNpc(retryKind?:GagKind,action:NpcOperation="prepare"){
    if(operation.current||autoRef.current)return;
    const controller=new AbortController();operation.current=controller;setBusy(true);setMessage("");
    try{
      if(retryKind&&action!=="prepare")await npc.recoverClip(castVoices.isti,retryKind,controller.signal,action);
      else if(retryKind)await npc.retryClip(castVoices.isti,retryKind,controller.signal);
      else await npc.inspect(castVoices.isti,controller.signal);
      setMessage(action==="prepare-beg"?"A térdelős jelenet és Isti hangjának mentése elindult. Az Állapot frissítése gombbal ellenőrizheted.":action==="activate-galaxy"?"Az ellenőrzött Galaxis-változat kiválasztva. Indítsd újra a mentett műsort a betöltéshez.":retryKind?"Egy célzott új próbálkozás elindult. A többi mentett jelenet változatlan.":"A mentett jelenetek állapota frissítve. Nem indult új generálás.");
    }catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"Jelenetállapot-hiba");}
    finally{if(operation.current===controller){operation.current=null;setBusy(false);}}
  }
  async function playGiftGag(signal:AbortSignal,kind:GagKind) {
    if(!npcPlayer.current)throw new Error("Előbb indítsd el a mentett NPC-jelenetet.");
    if(!npc.assets?.gags?.[kind])throw new Error(`${GAG_META[kind].label}: a jelenet még nincs elmentve. Készítsd elő a gegeket.`);
    dj.cue("drama");
    let stopSound:(()=>void)|undefined;
    try { await npcPlayer.current.react(signal,async()=>{stopSound=gagSound.play(kind,signal);},kind); }
    finally {stopSound?.();}
  }
  function pickReadyGag(event:LiveEvent){
    const requested=gagPicker.current.pick(event);
    if(requested==="gag-beg"&&!npc.assets?.begVoice)return undefined;
    return availableGiftGag(requested,npc.assets?.gags);
  }
  async function previewMusicGift(){
    if(operation.current||autoRef.current||!backdropActive)return;
    const controller=new AbortController();operation.current=controller;setBusy(true);setMessage("");
    try{
      await Promise.all([speech.unlock(),gagSound.unlock()]);
      const event:LiveEvent={id:crypto.randomUUID(),type:"gift",user:testUser.trim()||"Próbanéző",text:"",gift:"Gegpróba",giftValue:250,count:1};
      const kind=previewGag==="random"?pickReadyGag(event):previewGag;
      if(!kind||!npc.assets?.gags?.[kind])throw new Error("Ez a jelenet még nincs elmentve. Válassz egy elkészült geget.");
      const dialogue=giftDialogue(event,giftReplyCount.current++,kind);
      await speakDialogue(dialogue,event,controller.signal,undefined,kind);
      setMessage(`${GAG_META[kind].label} • ${GAG_META[kind].playbackSeconds} másodperces jelenet lejátszva.`);
    }
    catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:"Reakcióhiba");}
    finally{if(operation.current===controller){operation.current=null;setBusy(false);}}
  }
  async function startShow(trial=false) {
    if(operation.current||autoRef.current)return;
    if(!trial&&!/^[a-zA-Z0-9_.]{2,32}$/.test(username.replace(/^@/,"").trim())){setMessage("Add meg annak a TikTok-fióknak a felhasználónevét, amelyiken az adás fut.");return;}
    if(!trial&&connectionMode==="local"&&!pairing.trim()){setMessage("Add meg a helyi összekötő párosítási kódját, vagy válaszd a szerveres kapcsolatot.");return;}
    if(!service?.ai||!service.voice){setMessage("Az automata műsorhoz AI-válaszadó, mindkét karakter és a saját hangok szükségesek.");return;}
    if(replyCount.current+(trial?2:1)>limit){setMessage("Növeld az adás válaszkorlátját a műsor indítása előtt.");return;}
    const controller=new AbortController();operation.current=controller;setBusy(true);setMessage("");
    setScene("duo");setMode("ai");setVoiceMode("eleven");setMotionMode(false);setContinuous(true);continuousRef.current=true;
    setSpeaker(undefined);setCaption("Ali figyel, Isti duzzog. A műsor mindjárt indul.");setEffect(undefined);
    queue.current.clear();setPending([]);trialRemaining.current=trial?2:null;
    if(!trial)mobile.open();
    try {
      await Promise.all([speech.unlock(),musicBed.unlock(), dj.unlock(),gagSound.unlock()]);
      await npc.ensure(castVoices.isti,controller.signal);
      controller.signal.throwIfAborted();
      musicBed.start();
      dj.start();
      controller.signal.throwIfAborted();
      autoRef.current=true;setAuto(true);setBackdropActive(true);setCaption("Ali és Isti figyelnek. Jöhetnek a kommentek!");
      if(trial){
        queue.current.add({id:crypto.randomUUID(),type:"comment",user:testUser.trim()||"Próbanéző",text:testText.trim()||"Ali, miért duzzog már megint Isti?",count:1});
        setPending(queue.current.snapshot());
        trialGiftTimer.current=setTimeout(()=>enqueueRef.current({id:crypto.randomUUID(),type:"gift",user:testUser.trim()||"Próbanéző",text:"",gift:testGift,giftId:musicGiftId||undefined,giftValue:testGiftValue,count:testGiftCount}),1500);
      }else if(!connected)tiktok.connect(connectionMode,username,pairing);
    }catch(error){
      pause();dj.stop();if(!controller.signal.aborted||error instanceof Error&&error.name!=="AbortError")setMessage(error instanceof Error?error.message:"A műsor nem indult el.");
      mobile.setControls(true);
    }finally{
      if(operation.current===controller){operation.current=null;setBusy(false);}
      if(autoRef.current)void processRef.current();
    }
  }
  async function manualSpeech(role?: Speaker) {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage(""); setSpeaker(role); setEffect(undefined); setEmotion("neutral");
    const line = role === "ali" ? "Szia! Ali vagyok, a boszorkány. Isti, készülj egy kis varázslatra!" : role === "isti" ? "Szia! Isti vagyok. Ali, hagyj már békén ebben a székben!" : text;
    setCaption(line);
    try { if (voiceMode === "eleven") await speech.unlock(); await speech.say(line, voiceMode, role ? castVoices[role] : character.voiceId, controller.signal); }
    catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Hanghiba"); }
    finally { operation.current = null; setBusy(false); if (autoRef.current) void processRef.current(); }
  }
  async function speakDialogue(dialogue: Dialogue, event: LiveEvent, signal: AbortSignal, prepared?: Response, gag?:GagKind) {
    const selected=gag || (continuousRef.current ? pickReadyGag(event) : undefined);
    let visual=Promise.resolve(),visualStarted=false;
    setEffect(undefined);
    const voice = playDialogue(dialogue,castVoices,continuousRef.current?"eleven":voiceMode,signal,async(turn,voiceId)=>{
      const onStart=()=>{
        if(selected&&!visualStarted){
          visualStarted=true;setEffect(giftEffect(event,Date.now(),selected));
          visual=playGiftGag(signal,selected).catch(error=>{if(!signal.aborted)setMessage(error instanceof Error?error.message:"Geg lejátszási hiba");});
        }
        if(replyStartedAt.current){setFirstAudioMs(Math.round(performance.now()-replyStartedAt.current));replyStartedAt.current=0;}
        setSpeaker(turn.speaker);setCaption(turn.text);setEmotion(turn.emotion);dj.emotion(turn.emotion,turn.text);
      };
      if(!continuousRef.current&&motionMode&&voiceMode==="eleven")await motion.say(turn,voiceId,signal,onStart);
      else if(selected==="gag-beg"&&npc.assets?.begVoice)await speech.playSaved(npc.assets.begVoice,signal,onStart);
      else await speech.say(turn.text,continuousRef.current?"eleven":voiceMode,voiceId,signal,onStart,prepared);
    });
    await voice;
    await visual;
    setCaption("");setSpeaker(undefined);
  }
  async function demoScene() {
    if (operation.current) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage("");
    const event: LiveEvent = {id:crypto.randomUUID(), type:"gift", user:"Próbanéző", text:"", gift:testGift, giftValue:testGiftValue,count:testGiftCount};
    try { if (voiceMode === "eleven") await speech.unlock(motionMode ? motion.element.current : speech.element.current); await speakDialogue(rehearsalDialogue(event), event, controller.signal); }
    catch (e) { setEffect(undefined); if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "Jelenethiba"); }
    finally { operation.current = null; setBusy(false); }
  }
  async function getDialogue(event:LiveEvent,recent:{user:string;text:string;reply:string}[],signal:AbortSignal,withAudio:boolean,music?:{requested:string;started:boolean},replyIndex=replyCount.current) {
    const combined=withAudio&&(continuousRef.current||voiceMode==="eleven")&&!motionMode;
    const response=await fetch(combined?"/api/live-studio/respond":"/api/live-studio/dialogue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event,history:recent,replyIndex,music,...(combined?{voices:castVoices}:{})}),signal});
    if(combined&&response.ok&&response.headers.get("X-Live-Dialogue"))return {dialogue:dialogueSchema.parse(JSON.parse(decodeURIComponent(response.headers.get("X-Live-Dialogue")!))),audio:response};
    return {dialogue:dialogueSchema.parse(await readAIResponse(response)),audio:undefined};
  }
  async function previewAI(play = false) {
    if (operation.current || auto) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage(""); setAIPreview(null);
    try {
      if (play && voiceMode === "eleven") await speech.unlock(motionMode ? motion.element.current : speech.element.current);
      controller.signal.throwIfAborted();
      const event: LiveEvent = {id:crypto.randomUUID(), type:"comment", user:testUser.trim(), text:testText.trim(), count:1};
      replyStartedAt.current=performance.now();
      const recent = history.current.filter(l => !l.error && l.source === "ai").slice(-8).map(l => ({user:l.event.user, text:l.event.text || l.event.gift || "", reply:l.reply.slice(0,520)}));
      const {dialogue,audio}=await getDialogue(event,[...recent,...previewHistory.current].slice(-8),controller.signal,play,undefined,replyCount.current+silentPreviewCount.current);
      controller.signal.throwIfAborted(); setAIPreview(dialogue);
      previewHistory.current=[...previewHistory.current,{user:event.user,text:event.text,reply:dialogue.turns.map(turn=>`${CAST[turn.speaker].name}: ${turn.text}`).join(" · ")}].slice(-8);
      if (!play) silentPreviewCount.current++;
      if (play) {
        await speakDialogue(dialogue, event, controller.signal,audio);
        addLog({event, reply:dialogue.turns.map(turn => `${CAST[turn.speaker].name}: ${turn.text}`).join(" · "), source:"ai"});
        replyCount.current++; setReplies(replyCount.current);
        setMessage("Az egyszeri AI-kommentpróba befejeződött. A rövid válasz lejátszódott.");
      }
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : "AI-hiba"); }
    finally { operation.current = null; setBusy(false); }
  }
  async function processNext() {
    if (operation.current || !autoRef.current) return;
    clearTimeout(retryQueueTimer.current);
    if (replyCount.current >= limit) { pause(); setMessage("Elérted az adás válaszkorlátját. A folytatáshoz növeld a korlátot."); return; }
    const event = queue.current.take(); setPending(queue.current.snapshot()); setDropped(queue.current.dropped);
    if (!event) {
      if(queue.current.size)retryQueueTimer.current=setTimeout(()=>{if(autoRef.current)void processRef.current();},250);
      return;
    }
    clearTimeout(retryQueueTimer.current);
    replyStartedAt.current=performance.now();
    const controller = new AbortController(); operation.current = controller; setBusy(true); setMessage("");
    try {
      let spoken: string;
      const savedGift=scene==="duo"&&event.type==="gift";
      const recent = history.current.filter(l => !l.error && l.source === "ai").slice(-8).map(l => ({user:l.event.user, text:l.event.text || l.event.gift || "", reply:l.reply.slice(0,520)}));
      const requested = event.type === "comment" ? songRequest(event.text) : null;
      let started = false;
      if (requested) {
        const matches = tracks.filter(track => normalize(track.title) === normalize(requested));
        started = autoMusic && matches.length === 1 ? await playTrack(matches[0]) : false;
      }
      if (scene === "duo") {
        let dialogue: Dialogue;let prepared:Response|undefined;
        const gag=savedGift&&continuousRef.current?pickReadyGag(event):undefined;
        if (savedGift) dialogue=giftDialogue(event,giftReplyCount.current++,gag);
        else if (mode === "rehearsal") dialogue = rehearsalDialogue(event, started);
        else {
          const commentStartedAt=replyStartedAt.current;
          const result=await giftPriority.current.during(
            getDialogue(event,recent,controller.signal,true,requested?{requested,started}:undefined),
            controller.signal,
            // Keep one reply slot reserved for this already-paid comment.
            ()=>replyCount.current+1<limit&&(trialRemaining.current===null||trialRemaining.current>1)?queue.current.takeGift():undefined,
            async gift=>{
              setPending(queue.current.snapshot());
              replyStartedAt.current=performance.now();
              const giftGag=continuousRef.current?pickReadyGag(gift):undefined;
              const giftReply=giftDialogue(gift,giftReplyCount.current++,giftGag);
              await speakDialogue(giftReply,gift,controller.signal,undefined,giftGag);
              addLog({event:gift,reply:giftReply.turns.map(turn=>`${CAST[turn.speaker].name}: ${turn.text}`).join(" · "),source:"saved"});
              replyCount.current++;setReplies(replyCount.current);
              if(trialRemaining.current!==null)trialRemaining.current--;
            }
          );
          replyStartedAt.current=commentStartedAt;
          dialogue=result.dialogue;prepared=result.audio;
        }
        await speakDialogue(dialogue, event, controller.signal,prepared,gag);
        spoken = dialogue.turns.map(turn => `${CAST[turn.speaker].name}: ${turn.text}`).join(" · ");
      } else {
        let reply: Reply;
        if (requested && mode === "rehearsal") reply = started ? {text: `${event.user}, indul a kért dal!`, emotion: "happy"} : rehearsalReply(event);
        else if (mode === "rehearsal") reply = rehearsalReply(event);
        else {
          const response = await fetch("/api/live-studio/reply", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({event, character:{name:character.name, personality:character.personality}, history:recent.slice(-6).map(h => ({...h, reply:h.reply.slice(0,350)})), music:requested ? {requested, started} : undefined}), signal:controller.signal});
          reply = replySchema.parse(await readAIResponse(response));
        }
        controller.signal.throwIfAborted(); setSpeaker(undefined); setCaption(reply.text); setEmotion(reply.emotion);dj.emotion(reply.emotion,reply.text);
        await speech.say(reply.text, voiceMode, character.voiceId, controller.signal);
        spoken = reply.text;
      }
      addLog({event, reply:spoken, source:savedGift?"saved":mode}); replyCount.current++; setReplies(replyCount.current);
      if(continuousRef.current){setSpeaker(undefined);setCaption("");}
      if(trialRemaining.current!==null&&--trialRemaining.current<=0){pause();setMessage("Az automata műsorpróba kész: a komment és az ajándék válasza is magától lejátszódott. A próba két válasz után megállt.");setCaption("Automata műsorpróba befejezve.");}
    } catch (e) {
      setEffect(undefined);
      addLog({event, reply:controller.signal.aborted ? "Megszakítva" : e instanceof Error ? e.message : "Válaszhiba", error:true});
      if (!controller.signal.aborted) { setMessage(e instanceof Error ? e.message : "Válaszhiba"); pause(); mobile.setControls(true); }
    } finally {
      operation.current = null; setBusy(false);
      if (autoRef.current) void processRef.current();
    }
  }
  processRef.current = processNext;
  function enqueue(event: LiveEvent) {
    if (!queue.current.add(event)) { setDropped(queue.current.dropped); return; }
    setDropped(queue.current.dropped);
    if(autoRef.current){
      dj.event(event,isMusicGift(event,musicGiftNames,musicGiftId),queue.current.size);

    }
    const requested = event.type === "comment" ? songRequest(event.text) : null;
    if (requested) setRequests(current => [...current, {user:event.user, title:requested}].slice(-30));
    setPending(queue.current.snapshot());
    if (event.type === "gift") giftPriority.current.notify();
    if (autoRef.current) void processRef.current();
  }
  enqueueRef.current = enqueue;
  async function toggleAuto() {
    if (autoRef.current) { pause(); return; }
    if (operation.current) return;
    continuousRef.current=false;setContinuous(false);
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
  function connect() { tiktok.connect(connectionMode, username, pairing); }
  async function playTrack(track: MusicTrack): Promise<boolean> {
    if(dj.played.has(track.id)){setMessage("Ez a szám már elhangzott. Ebben a műsorban nem ismételjük meg.");return false;}
    try { return await dj.play(track); }
    catch { setMessage("A zene indításához érintsd meg a DJ hangpróba gombot."); return false; }
  }
  async function previewDj() {
    try { await Promise.all([musicBed.unlock(),dj.unlock()]); musicBed.start();dj.start(); }
    catch { setMessage("A zene indítását a böngésző nem engedte. Próbáld újra a DJ hangpróba gombbal."); }
  }

  return <div className="space-y-6 pb-12">
    <header className="flex flex-wrap justify-between items-center gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-amber-400">WonderlyTales</p><h1 className="text-3xl font-bold">Élő karakterstúdió</h1><p className="mt-2 text-zinc-400">Magyar műsorvezető • Kommentek és ajándékok • Zenekérések</p></div><button className="rounded-lg bg-red-700 px-4 py-3 text-white font-bold" onClick={stopAll}>Mindent leállít</button></header>
    <section className="space-y-3 rounded-2xl border border-emerald-700 bg-emerald-950/20 p-5">
      <h2 className="text-2xl font-semibold">Automata műsor</h2>
      <p className="text-sm text-zinc-200">Névre szóló, rövid visszaszólások, teljes csattanóval. 1–9 pont: beszólás. 10–199 pont: Isti térden könyörög. 200–999 pont: hat látványos geg kevert sorrendben. A Galaxis saját csillagos kilövést kap; a nagyobb ajándékokhoz 5–6 másodperces nagyjelenet jár. A mozgó alapjelenet és a DJ folyamatos.</p>
      <label className="block">Adás TikTok-felhasználóneve<input className={field} disabled={busy||auto||connected||tiktok.busy} placeholder="@felhasznalonev" maxLength={33} value={username} onChange={e=>setUsername(e.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={busy||auto||tiktok.busy} onClick={()=>void startShow()}>Automata műsor indítása</button><button className="rounded-lg border border-emerald-500 px-4 py-2 disabled:opacity-40" disabled={busy||auto||connected||tiktok.busy} onClick={()=>void startShow(true)}>Automata műsorpróba – komment + ajándék</button><button className="rounded-lg border border-zinc-500 px-4 py-2 disabled:opacity-40" disabled={busy||auto||tiktok.busy} onClick={()=>void previewBackdrop()}>Mentett NPC-műsor és zene próbája</button>{(auto||backdropActive)&&<button className="rounded-lg bg-red-700 px-4 py-2" onClick={stopAll}>Automata műsor leállítása</button>}</div>
      <p className="text-xs text-zinc-400">A TikTok-adást egyszer el kell indítanod a Mobil játék módban. Utána ez a gomb a kommentfigyelőt, a válaszadást és a telefonos adásképet együtt indítja. A próba TikTok nélkül, a lent megadott kommentből és ajándékból két új választ játszik le, majd megáll.</p>
      <p className="text-xs text-amber-200">A kommentválaszok szöveget és hangot készítenek; nincs válaszonkénti videógenerálás. A nagy ajándékok előre mentett gegeket használnak. Az adás válaszkorlátjánál a műsor megáll.</p>
      {npc.manifest&&npc.manifest.clips.some(clip=>clip.kind.startsWith("gag-")&&clip.status!=="SUCCEEDED")&&<p role="status" className="rounded-lg border border-amber-700 p-3 text-sm text-amber-200">{npc.manifest.clips.filter(clip=>clip.kind.startsWith("gag-")&&clip.status==="SUCCEEDED").length}/{GAG_KINDS.length} ajándékgeg kész. A műsor a kész jelenetekkel indul. A hiányzó nagyjelenetek helyett egy elkészült geg játszódik le, hozzá illő beszólással; a csillagos kilövés kizárólag a Galaxisé.{npc.manifest.clips.some(clip=>clip.error==="NPC_CREDITS_REQUIRED")?" Egy korábbi kérés kredit hiányában elakadt; feltöltés után külön folytatható.":""}</p>}
      <details className="rounded-lg border border-zinc-700 p-3"><summary className="cursor-pointer">NPC-jelenetek és rövid ajándékgegek</summary><div className="mt-3 space-y-3">
        <p className="text-sm">Hat 4 másodperces geg: habkakás tál, dupla tejszínhab, óriáspite, nyálkavödör, rázós szék és konfettiágyú. Egy kevert körben mind a hat sorra kerül. Galaxis: {npc.manifest?.galaxyRevision?.approved?"az ellenőrzött új változat":"csillagos kilövés; a felrúgós változat külön ellenőrzést kap"}. Nagyobb ajándékok: habtornádó, óriás buborék, rakétaszék és kozmikus pitezápor. Az előkészítés megőrzi a korábbi alapjeleneteket.</p>
        <button className={button} disabled={busy||auto} onClick={()=>void previewBackdrop(true)}>NPC-jelenetek és rövid gegek előkészítése</button>
        <button className={button} disabled={busy||auto} onClick={()=>void inspectNpc()}>Mentett gegek állapotának frissítése</button>
        {npc.manifest&&(npc.manifest.clips.find(clip=>clip.kind==="gag-beg")?.status==="MISSING"||npc.manifest.begVoice?.status==="MISSING")&&<button className={button} disabled={busy||auto} onClick={()=>void inspectNpc("gag-beg","prepare-beg")}>10 pontos térdelős jelenet és hang elkészítése</button>}
        {npc.manifest?.begVoice&&<p className="text-sm">Térdelős jelenet mentett hangja: {npc.manifest.begVoice.status==="SUCCEEDED"?"Elkészült":npc.manifest.begVoice.status==="MISSING"?"Még nincs elkészítve":npc.manifest.begVoice.status}</p>}
        {npc.manifest&&<ul aria-label="Mentett gegek állapota" className="space-y-2 text-sm">{npc.manifest.clips.filter(clip=>clip.kind.startsWith("gag-")).map(clip=><li key={clip.kind} className="flex flex-wrap items-center gap-3"><span>{GAG_META[clip.kind as GagKind].label}: {clip.status==="SUCCEEDED"?"Elkészült":clip.status==="PENDING"?"Készül":clip.status==="MISSING"?"Még nincs elkészítve":clip.status==="SUBMITTING"?"Indítás alatt":"Ellenőrzést igényel"}{clip.error?` (${clip.error})`:""}</span>{clip.url&&<a className="text-amber-300 underline" href={clip.url} download={`${clip.kind}.mp4`}>{GAG_META[clip.kind as GagKind].label} ellenőrzése / letöltése</a>}{clip.creditRecoveryAllowed&&<button className={button} disabled={busy||auto} onClick={()=>void inspectNpc(clip.kind as GagKind,"recover-credit")}>Folytatás feltöltés után: {GAG_META[clip.kind as GagKind].label}</button>}{["FAILED","UNCERTAIN"].includes(clip.status)&&!clip.creditRecoveryAllowed&&(clip.attempts||1)<2&&<button className={button} disabled={busy||auto} onClick={()=>void inspectNpc(clip.kind as GagKind)}>Új próbálkozás: {GAG_META[clip.kind as GagKind].label}</button>}</li>)}</ul>}
        {npc.manifest?.clips.some(clip=>["FAILED","UNCERTAIN"].includes(clip.status))&&<p className="text-xs text-amber-200">Az új próbálkozás gomb egyetlen új, fizetős videót indít a kiválasztott hibás jelenethez. Az állapotfrissítés és az adásindítás nem ismétli meg a generálást.</p>}
        {npc.manifest?.galaxyRevision&&<div className="space-y-2 rounded border border-zinc-700 p-3" aria-label="Galaxis felrúgós változat">
          <p>Galaxis új változata: {npc.manifest.galaxyRevision.approved?"Ellenőrizve és kiválasztva":npc.manifest.galaxyRevision.status==="MISSING"?"Még nincs elkészítve":npc.manifest.galaxyRevision.status==="SUCCEEDED"?"Elkészült, megtekintésre vár":npc.manifest.galaxyRevision.status==="PENDING"?"Készül":"Ellenőrzést igényel"}</p>
          {npc.manifest.galaxyRevision.status==="MISSING"&&<button className={button} disabled={busy||auto} onClick={()=>void inspectNpc("gag-galaxy","revise-galaxy")}>Galaxis felrúgós változat elkészítése</button>}
          {npc.manifest.galaxyRevision.url&&<a className="mr-3 text-amber-300 underline" href={npc.manifest.galaxyRevision.url} download="galaxis-felrugas.mp4">Új Galaxis-változat megtekintése / letöltése</a>}
          {npc.manifest.galaxyRevision.status==="SUCCEEDED"&&!npc.manifest.galaxyRevision.approved&&<button className={button} disabled={busy||auto} onClick={()=>void inspectNpc("gag-galaxy","activate-galaxy")}>Ellenőriztem a felrúgást, ezt használjuk</button>}
          <p className="text-xs text-zinc-400">Egy új, fizetős 6 másodperces változat készül. Nézd meg, hogy Ali rúgása valóban látszik-e. A régi Galaxis-videó megmarad; az új csak kiválasztás után kerül a műsorba.</p>
        </div>}
        <label className="block">Zenés ajándék nevei (vesszővel elválasztva)<input className={field} maxLength={400} value={musicGiftNames} disabled={busy||auto} onChange={e=>{setMusicGiftNames(e.target.value);setMusicGiftId("");}} /></label>
        <label className="block">Pontos TikTok ajándékazonosító (ha ismert)<input className={field} inputMode="numeric" maxLength={30} value={musicGiftId} disabled={busy||auto} onChange={e=>setMusicGiftId(e.target.value.replace(/\D/g,""))} /></label>
        <p className="text-xs text-zinc-400">Az azonosító elsőbbséget élvez. Ha nincs megadva, csak a pontosan egyező ajándéknevek váltják a DJ hangulatát. A kommentbe írt „zene” nem ajándék. Az alábbi listában a már beérkezett valódi ajándékot egy érintéssel kiválaszthatod.</p>
        {logs.filter(l=>l.event.type==="gift").slice(-5).map(l=><button key={l.event.id} className="mr-2 rounded border border-zinc-600 p-2 text-sm" disabled={busy||auto} onClick={()=>{setMusicGiftNames(l.event.gift||"");setMusicGiftId(l.event.giftId||"");}}>DJ-hangulatváltás ehhez: {l.event.gift}{l.event.giftId?` (#${l.event.giftId})`:""}</button>)}
        <label className="block text-sm">Geg kiválasztása<select className={field} disabled={busy||auto} value={previewGag} onChange={e=>setPreviewGag(e.target.value as GagKind|"random")}><option value="random">Véletlen a hat alapgegből</option>{GAG_KINDS.map(kind=><option key={kind} value={kind}>{GAG_META[kind].label} • {GAG_META[kind].playbackSeconds} mp</option>)}</select></label>
        <button className={button} disabled={busy||auto||!backdropActive||!npc.assets} onClick={()=>void previewMusicGift()}>Rövid ajándékgeg próbája</button>
        {npc.assets&&<div className="flex flex-wrap gap-3 text-sm text-amber-300">{npc.assets.idle.map((url,i)=><a key={url} href={url} download={`npc-alap-${i+1}.mp4`}>Alapjelenet {i+1} letöltése</a>)}{Object.entries(npc.assets.gags||{}).map(([kind,url])=><a key={kind} href={url} download={`${kind}.mp4`}>{GAG_META[kind as GagKind].label} letöltése</a>)}</div>}
      </div></details>
      {npc.status&&<p role="status" className="text-sm text-emerald-200">{npc.status}</p>}
    </section>
    <div className="grid gap-6 xl:grid-cols-[minmax(340px,520px)_1fr]">
      <aside className="space-y-4"><div ref={mobile.container} className={mobile.active ? "fixed inset-0 z-[100] grid place-items-center bg-black" : ""}>
        <Stage state={state} full={mobile.active} playbackRef={motion.element} onBackdropError={onBackdropError} npcAssets={npc.assets} npcRef={npcPlayer} onNpcFrame={setNpcFrame} />
        {mobile.active && <><button aria-label="Mobil adáskép vezérlőinek megjelenítése" className="absolute inset-0 z-10 cursor-default" onClick={()=>mobile.setControls(!mobile.controls)} />{mobile.controls && <div className="absolute inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-20 space-y-2 rounded-xl bg-black/90 p-3 text-white">
          <div className="flex flex-wrap gap-2"><button className={button} onClick={mobile.close}>Vissza a vezérléshez</button><button className="rounded-lg bg-red-700 px-4 py-2 font-bold" onClick={stopAll}>Mindent leállít</button></div>
          <p className="text-xs">Érintsd meg a képet a vezérlőkhöz. A gombok 6 másodperc után eltűnnek.</p>
          <p role="status" className="text-sm">{message || npc.status || (busy ? motion.status : "") || bridgeStatus}</p>
          <p className="text-xs">TikTok: {bridgeStatus}<br/>Beérkezett: {tiktok.receivedEvents.comment} komment · {tiktok.receivedEvents.gift} ajándék<br/>Válaszadás: {auto ? connected ? busy ? "válasz készül / lejátszás" : "aktív" : "kapcsolódásra vár" : "szünetel"} · Várakozó: {pending.length}</p>
          {!auto&&!busy&&<button className={button} disabled={tiktok.busy} onClick={()=>void startShow()}>Automata válaszadás folytatása</button>}
        </div>}</>}
      </div><button className={`${button} w-full`} onClick={mobile.open}>Telefonos adáskép – kép és hang együtt</button><p className="text-xs text-zinc-400">A telefonon ezt az oldalt tartsd előtérben a TikTok képernyőközvetítése alatt. Az adáskép nem indít közvetítést. A kép megérintésével előhívhatod a vezérlőket.</p><button className={`${button} w-full`} onClick={() => {const popup = window.open(`/live-studio/output#${outputId.current}`, "wonderly-live-output", "width=540,height=960"); if (!popup) setMessage("Engedélyezd a felugró ablakot az adáskép megnyitásához.");}}>Tiszta adáskép külön ablakban ↗</button><p className="text-xs text-zinc-400">A LIVE Studio az adáskép ablakát rögzítse. A hang a vezérlő stúdiófülön szól; ezt hagyd nyitva.</p><div className={panel}><h2 className="font-semibold">Állapot</h2><p className="text-sm">AI: {service ? service.ai ? `beállítva (${service.aiModel || "AI"})` : "nincs beállítva" : "ellenőrzés…"}<br/>ElevenLabs: {service ? service.voice ? "beállítva" : "nincs beállítva" : "ellenőrzés…"}<br/>TikTok: {bridgeStatus}<br/>Elhangzott válasz: {replies} / {limit}<br/>Várakozó: {pending.length}{dropped > 0 && <><br/>Torlódás miatt kihagyva: {dropped}</>}</p>{speech.timed && <p className="text-xs text-emerald-300">Beszédidőzítés rendelkezésre áll{speech.word ? ` • ${speech.word}` : ""}</p>}</div></aside>
      <div className="space-y-5">
        <section className={panel}><h2 className="text-xl font-semibold">Műsorjelenet</h2>
          <label className="flex items-center gap-2"><input type="checkbox" checked={motionMode} disabled={busy || auto || continuous || scene!=="duo" || voiceMode!=="eleven" || !service?.motion?.configured} onChange={e=>setMotionMode(e.target.checked)} />Runway beszélő videó külön kézi próbákhoz</label>
          <p className="text-xs text-zinc-400">{service?.motion?.configured ? "Mindkét karakter bekötve." : "A videómódhoz mindkét Runway-karakter beállítása szükséges."} Egy megszólalás legfeljebb 30 másodperc; legfeljebb 12 Runway API-kredit, plusz a saját hang költsége. Egy kétfős válasz legfeljebb 24 kredit. A Runway webes Pro-kerete külön egyenleg. A készülő videó leállítható, de a már elindított generálás díja megmaradhat.</p>
          {busy && motion.status && <p role="status" className="text-sm text-violet-300">{motion.status}</p>}
          <label className="block">Jelenet<select className={field} disabled={busy || auto} value={scene} onChange={e => {pause(); setScene(e.target.value as "solo" | "duo"); setSpeaker(undefined); history.current=[]; setLogs([]); setCaption("Kezdődhet a műsor!");}}><option value="duo">Ali boszorkány és a duzzogó Mc Isti</option><option value="solo">Egyszereplős karakter</option></select></label>
          {scene === "duo" && <><p className="text-sm text-zinc-300">Ali és Isti röviden visszaszólnak a nézőknek és egymásnak. Isti néha Alinak is odaszúr a „te dagadt kétszáz kilós” fordulattal. A jelmez marad, a beszéd hétköznapi trash-komédia. A kommentekre egy szereplő válaszol.</p><p className="text-xs text-zinc-400">1–9 pont → beszólás · 10–199 pont → térdelős könyörgés · 200–999 pont → hat kevert geg · Galaxis és nagyobb ajándék → külön nagyjelenet</p><button className={button} disabled={busy || auto} onClick={() => void demoScene()}>Technikai hangpróba – rögzített tesztszöveg</button><button className="ml-2 rounded-lg border border-violet-400 px-4 py-2 text-sm disabled:opacity-40" disabled={busy || auto} onClick={() => {setSpeaker(undefined); setCaption("Varázseffekt próba – hang nélkül."); setEffect(giftEffect({id:crypto.randomUUID(),type:"gift",user:"Próbanéző",text:"",gift:testGift,giftValue:testGiftValue,count:testGiftCount}));}}>Varázseffekt próba hang nélkül</button></>}
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
          <p className="text-xs text-zinc-400">Egy kommentre egy szereplő felel, a néző nevét kimondva, 1–2 rövid, teljes mondattal. A kis ajándékoknál változatos beszólás és időnként nagyobb csínyre hívás; a rózsasorozatot összevonjuk. 10–199 pontnál a mentett térdelős jelenet, 200 ponttól a nagy gegek jönnek. Az ajándék a készülő kommentválasz elé kerül; a már elindult beszéd végigmegy. Sok kommentnél a két legfrissebb vár, a 10 másodpercnél régebbiek kimaradnak.</p>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]"><input aria-label="Próbanéző neve" className={field} value={testUser} maxLength={80} onChange={e=>setTestUser(e.target.value)} /><input aria-label="Próbakomment" className={field} value={testText} maxLength={500} onChange={e=>setTestText(e.target.value)} /></div>
          {scene === "duo" && <div className="space-y-2"><div className="flex flex-wrap gap-2"><button className={button} disabled={busy || auto || !service?.ai || !testUser.trim() || !testText.trim()} onClick={() => void previewAI()}>AI-kommentpróba hang nélkül</button><button className={button} disabled={busy || auto || !service?.ai || !testUser.trim() || !testText.trim() || (voiceMode === "eleven" && (!service?.voice || !castVoices.ali || !castVoices.isti)) || (motionMode && !service?.motion?.configured)} onClick={() => void previewAI(true)}>{motionMode && voiceMode === "eleven" ? "Egyszeri AI-videópróba" : "Egyszeri AI-hangpróba"}</button></div><p className="text-xs text-zinc-400">Mindkét próba új választ ír a kommentre. A hang nélküli próba csak szöveget készít. Az egyszeri lejátszás a kiválasztott hangot és videómódot használja, egy rövid válasz után megáll. Videómódban a generálásra várni kell; ez még nem azonnali élő mozgás.</p>{aiPreview && <div role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-3 space-y-2">{aiPreview.turns.map(turn => <p key={turn.speaker}><strong>{CAST[turn.speaker].name}:</strong> {turn.text}</p>)}</div>}</div>}
          <label className="block text-sm">Próbaajándék típusa<select className={field} value={testGift} onChange={e=>setTestGift(e.target.value)}><option value="Zene">Zene</option><option value="rózsa">Rózsa – rövid beszólás</option><option value="szív">Szív</option><option value="varázspálca">Varázspálca</option><option value="Galaxis">Galaxis – csillagos kilövés</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label>Ajándék értéke (pont/db)<input className={field} type="number" min={0} max={1000000} value={testGiftValue} onChange={e=>setTestGiftValue(Math.max(0,Math.min(1000000,Number(e.target.value)||0)))} /></label><label>Darabszám<input className={field} type="number" min={1} max={10000} value={testGiftCount} onChange={e=>setTestGiftCount(Math.max(1,Math.min(10000,Number(e.target.value)||1)))} /></label></div>
          {firstAudioMs!==undefined&&<p className="text-sm text-emerald-300" role="status">Legutóbbi válasz hangindulása: {(firstAudioMs/1000).toFixed(1)} mp</p>}
          <div className="flex flex-wrap gap-2"><button className={button} disabled={!testUser.trim() || !testText.trim()} onClick={()=>enqueue({id:crypto.randomUUID(),type:"comment",user:testUser.trim(),text:testText.trim(),count:1})}>Próbakomment</button><button className={button} disabled={!testUser.trim()} onClick={()=>enqueue({id:crypto.randomUUID(),type:"gift",user:testUser.trim(),text:"",gift:testGift,giftValue:testGiftValue,count:testGiftCount})}>Próbaajándék</button><button className="rounded-lg border border-zinc-600 px-3" onClick={()=>{queue.current.clear();setPending([]);}}>Várakozók törlése</button></div>
          {pending.length>0 && <div className="max-h-40 overflow-auto space-y-1 text-sm">{pending.map(e=><p key={e.id}><strong>{e.user}</strong>: {e.type==="gift"?`🎁 ${e.count} ${e.gift}`:e.text}</p>)}</div>}
          {logs.length>0 && <details><summary className="cursor-pointer">Elhangzott válaszok és hibák ({logs.length})</summary><div className="max-h-64 overflow-auto space-y-3 mt-2">{[...logs].reverse().map((l,i)=><div key={`${l.event.id}-${i}`} className={`rounded-lg p-3 text-sm ${l.error?"bg-red-950/40":"bg-zinc-900"}`}><strong>{l.event.user}</strong>: {l.event.text || l.event.gift}<p className="mt-1 text-zinc-300">{l.reply}</p>{l.error && <button className="text-amber-300 mt-2" onClick={()=>enqueue({...l.event,id:crypto.randomUUID()})}>Újrapróbálás a sorban</button>}</div>)}</div></details>}
        </section>
        <section className={panel}><h2 className="text-xl font-semibold">TikTok-kommentkapcsolat</h2>
          <label className="block">Kapcsolódás módja<select className={field} disabled={connected || tiktok.busy} value={connectionMode} onChange={e=>setConnectionMode(e.target.value as ConnectionMode)}><option value="cloud">Telefon / szerver – számítógép nélkül</option><option value="local">Számítógépes összekötő</option></select></label>
          <p className="text-sm text-zinc-400">{connectionMode === "cloud" ? "A kommenteket és az ajándékokat a stúdió szervere olvassa. TikTok-jelszó nem kell. A fióknak már élő adásban kell lennie; ez a gomb nem indít közvetítést." : "Az összekötő ugyanazon a számítógépen fusson, ahol ez a stúdió nyitva van. Aktív TikTok LIVE-adást olvas; közvetítést nem indít."}</p>
          <label className="block">TikTok felhasználónév<input className={field} disabled={connected || tiktok.busy} placeholder="@felhasznalonev" maxLength={33} value={username} onChange={e=>setUsername(e.target.value)} /></label>
          {connectionMode === "local" && <label className="block">Összekötő párosítási kódja<input className={field} type="password" autoComplete="off" value={pairing} onChange={e=>setPairing(e.target.value)} /></label>}
          <div className="flex flex-wrap gap-2"><button className={button} disabled={connected||tiktok.busy} onClick={connect}>Kapcsolódás</button><button className={button} onClick={()=>{tiktok.disconnect();pause();}}>Bontás</button>{connectionMode === "cloud" && <button className="rounded-lg border border-zinc-600 px-3 py-2 disabled:opacity-40" disabled={connected||tiktok.busy} onClick={()=>tiktok.connect("cloud","","",true)}>Telefonos kapcsolat ellenőrzése</button>}</div>
          <p role="status" className="text-sm">{bridgeStatus}</p>
          <p aria-label="Beérkezett TikTok-események" className="text-sm">Beérkezett: {tiktok.receivedEvents.comment} komment · {tiktok.receivedEvents.gift} ajándék · {tiktok.receivedEvents.follow} követés. Válaszadás: {auto ? connected ? "aktív" : "kapcsolódásra vár" : "szünetel"}.</p>
          <p className="text-xs text-zinc-400">Az ellenőrzés nem indít adást vagy AI-generálást. A TikTok-kapcsolat nem hivatalos összekötőt használ, ezért szolgáltatói hiba vagy korlátozás esetén leállhat. Szerveres módban fiókonként egy kapcsolat futhat.</p>
          {connectionMode === "local" && <a className="text-sm text-amber-300 underline" href="https://github.com/moldovansandor1998-ai/Wonderlytales/tree/main/tools/tiktok-bridge" target="_blank" rel="noreferrer">Összekötő és indítási útmutató ↗</a>}
        </section>
        <MusicPanel dj={dj} playing={musicBed.playing} volume={volume} setVolume={setVolume} background={backgroundMusic} setBackground={setBackgroundMusic} autoRequests={autoMusic} setAutoRequests={setAutoMusic} requests={requests} play={playTrack} preview={()=>void previewDj()} stop={()=>{dj.stop();musicBed.stop();}} />
        <MotionHistory disabled={busy || auto} stopSignal={avatarStop} onStageReplay={clip=>void replayOnStage(clip)} />
        <AvatarPreview configuration={service?.avatar} disabled={speechBusy || auto} stopSignal={avatarStop} onActive={active => {setAvatarTesting(active); if (active) {pause(); dj.stop();}}} />
        <section className={panel}><h2 className="text-xl font-semibold">Telefonos adás előkészítése</h2><ol className="list-decimal pl-5 space-y-2 text-sm"><li>Add meg felül a TikTok-felhasználónevedet. Az automata műsorpróba külön adás nélkül is ellenőrzi a teljes válaszfolyamatot.</li><li>A TikTokban válaszd a Mobil játék módot, álló (9:16) adásképet, és kapcsold be az MI által generált tartalom jelölését. A fekvő TikTok-vászon kicsinyíti az álló képet.</li><li>A képernyőközvetítés engedélyezése után térj vissza a böngészőbe, és nyomd meg az „Automata műsor indítása” gombot.</li><li>A mozgó jelenet, a kommentfigyelés és a reakciók ezután maguktól működnek. Másik készüléken ellenőrizd a közvetített képet és hangot.</li></ol><p className="text-xs text-zinc-400">A telefon képernyője és az előhívott vezérlők is látszhatnak az adásban. A rendszerhang továbbítását a saját telefonodon kell kipróbálni; a böngészős próba önmagában ezt nem igazolja.</p></section>
        <section className={panel}><h2 className="text-xl font-semibold">Adás indítása számítógépről</h2><ol className="list-decimal pl-5 space-y-2 text-sm"><li>Válassz karaktert és hangot, majd próbáld ki a felolvasást.</li><li>Nyisd meg a tiszta adásképet; a vezérlő stúdió maradjon nyitva.</li><li>A TikTok LIVE Studio alkalmazásban állíts be 9:16 képet, az adáskép ablakának rögzítését és a géphangot.</li><li>A LIVE Studio alkalmazásból indítsd el az adást. Ezután csatlakoztasd a kommentfigyelőt és indítsd az automatikus válaszadást.</li></ol></section>
      </div>
    </div>
    {message && <div role="status" className="sticky bottom-3 rounded-xl border border-amber-600 bg-zinc-950 p-4 text-amber-200">{message}<button className="float-right ml-4" aria-label="Üzenet bezárása" onClick={()=>setMessage("")}>×</button></div>}
    <audio ref={speech.element} className="hidden" />
  </div>;
}
