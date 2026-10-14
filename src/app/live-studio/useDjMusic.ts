"use client";
import { useEffect, useRef, useState } from "react";
import { DjDirector, normalizeDjMood, type DjMood, type MusicTrack } from "@/lib/live/dj";
import { DjMixer } from "@/lib/live/dj-mixer";
import { musicLibrary, type SavedMusic } from "@/lib/live/music-library";
import type { Emotion, LiveEvent } from "@/lib/live/events";

export function useDjMusic(volume: number, duck: boolean, onError: (message: string) => void) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [current, setCurrent] = useState<MusicTrack>();
  const [mood, setMood] = useState<DjMood>("groove");
  const [adaptive, setAdaptive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [played, setPlayed] = useState<ReadonlySet<string>>(new Set());
  const director = useRef(new DjDirector());
  const mixer = useRef<DjMixer>();
  const generation = useRef(0);
  const files = useRef(new Map<string, SavedMusic>());
  const urls = useRef(new Map<string, string>());
  const settings = useRef({ tracks, mood, adaptive, volume, duck, onError });
  settings.current = { tracks, mood, adaptive, volume, duck, onError };
  useEffect(() => {
    let disposed = false;
    void musicLibrary("list").then(records => {
      if (disposed) return;
      const restored = records.filter(record => record && record.file instanceof Blob && typeof record.id === "string" && typeof record.title === "string").map(saved => {
        const record = { ...saved, mood: normalizeDjMood(saved.mood) };
        files.current.set(record.id, record);
        const url = URL.createObjectURL(record.file); urls.current.set(record.id, url);
        return { id: record.id, title: record.title, mood: record.mood, url };
      });
      setTracks(restored);
    }).catch(() => { if (!disposed) settings.current.onError("A mentett zenetár most nem érhető el. A betöltött zenék ebben a munkamenetben használhatók."); })
      .finally(() => { if (!disposed) setLoading(false); });
    const timer = setInterval(() => setMood(settings.current.adaptive ? director.current.current : "groove"), 250);
    const resume = () => { if (document.visibilityState === "visible") void mixer.current?.unlock().catch(() => {}); };
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true; generation.current++; clearInterval(timer); document.removeEventListener("visibilitychange", resume);
      mixer.current?.dispose(); mixer.current = undefined;
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); files.current.clear();
    };
  }, []);
  useEffect(() => { mixer.current?.configure(tracks, mood, adaptive, volume, duck); }, [tracks, mood, adaptive, volume, duck]);
  async function unlock() {
    const token = generation.current;
    const instance = mixer.current ?? (mixer.current = new DjMixer(track => {
      setCurrent(track); setPlayed(new Set(mixer.current?.played));
    }, message => settings.current.onError(message)));
    const s = settings.current; instance.configure(s.tracks, s.mood, s.adaptive, s.volume, s.duck);
    await instance.unlock();
    if (token !== generation.current) throw new DOMException("Stopped", "AbortError");
  }
  function start() { mixer.current?.start(); }
  function stop() { generation.current++; director.current.reset(); setMood("groove"); mixer.current?.stop(); }
  async function play(track: MusicTrack) { await unlock(); return mixer.current?.play(track) ?? false; }
  async function next() { await unlock(); return mixer.current?.next() ?? false; }
  function event(event: LiveEvent, musicGift: boolean, queueSize: number) { if (adaptive) director.current.event(event, musicGift, queueSize); }
  function emotion(emotion: Emotion, text = "") { if (adaptive) director.current.emotion(emotion, text); }
  function cue(mood: DjMood) { if (adaptive) { director.current.cue(mood, 18, 3); setMood(mood); } }
  async function add(input: File[]) {
    setLoading(true);
    const remaining = 30 - files.current.size;
    const selected = input.filter(file => file.size > 0 && file.size <= 100 * 1024 * 1024 && (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/i.test(file.name))).slice(0, Math.max(0, remaining));
    if (selected.length < input.length) settings.current.onError("Legfeljebb 30 zenét, fájlonként maximum 100 MB-ot lehet betölteni. A nem támogatott fájlokat kihagytuk.");
    const added: MusicTrack[] = [];
    for (const file of selected) {
      const id = crypto.randomUUID(), title = file.name.replace(/\.[^.]+$/, ""), url = URL.createObjectURL(file);
      const record: SavedMusic = { id, title, mood: "any", file };
      files.current.set(id, record); urls.current.set(id, url); added.push({ id, title, mood: "any", url });
      try { await musicLibrary("save", record); }
      catch { settings.current.onError("A zene betöltve, de a böngésző nem tudta megőrizni. Új megnyitáskor ismét be kell tölteni."); }
    }
    setTracks(previous => [...previous, ...added]); setLoading(false);
  }
  async function tag(id: string, mood: MusicTrack["mood"]) {
    const record = files.current.get(id); if (!record) return;
    const updated = { ...record, mood }; files.current.set(id, updated);
    setTracks(previous => previous.map(t => t.id === id ? { ...t, mood } : t));
    try { await musicLibrary("save", updated); } catch { settings.current.onError("A zene hangulatát nem sikerült megőrizni."); }
  }
  async function remove(id: string) {
    try { await musicLibrary("remove", id); } catch { settings.current.onError("A mentett zenét nem sikerült törölni. Próbáld újra."); return; }
    // Stop both decks before revoking a URL that could still be fading out.
    stop();
    files.current.delete(id); const url = urls.current.get(id); if (url) URL.revokeObjectURL(url); urls.current.delete(id);
    setTracks(previous => previous.filter(t => t.id !== id));
  }
  return { tracks, current, mood, adaptive, setAdaptive, played, loading, unlock, start, stop, play, next, event, emotion, cue, add, tag, remove };
}
