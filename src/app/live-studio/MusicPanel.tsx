"use client";
import { DJ_MOODS, type DjMood, type MusicTrack } from "@/lib/live/dj";
import type { useDjMusic } from "./useDjMusic";

export default function MusicPanel({ dj, volume, setVolume, autoRequests, setAutoRequests, requests, play, preview, stop }: {
  dj: ReturnType<typeof useDjMusic>; volume: number; setVolume: (value: number) => void;
  autoRequests: boolean; setAutoRequests: (value: boolean) => void;
  requests: { user: string; title: string }[]; play: (track: MusicTrack) => Promise<boolean>;
  preview: () => void; stop: () => void;
}) {
  return <section className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-950/60 p-5">
    <div><h2 className="text-xl font-semibold">DJ és zenetár</h2><p className="mt-1 text-sm text-amber-200">Kizárólag az általad feltöltött zenék szólnak. Ha nincs elérhető feltöltött szám, a zene szünetel.</p></div>
    <label className="flex items-center gap-2"><input type="checkbox" checked={dj.adaptive} onChange={e => dj.setAdaptive(e.target.checked)} />Automata DJ – a műsor hangulatához igazítva</label>
    <p className="text-sm text-zinc-300">A DJ a feltöltött számaid közül választ a megadott hangulat szerint. A zenék 2,5 másodperces átkeveréssel váltanak; egy szám legalább 30 másodpercig marad, mielőtt a hangulat miatt másikat választunk. Ha minden szám lement, a zenelista az elejéről újraindul, és folyamatosan ismétlődik.</p>
    <p role="status" className="rounded-lg bg-zinc-900 p-3 text-emerald-300">DJ: {DJ_MOODS[dj.mood].label}{dj.current ? ` • ${dj.current.title}` : " • Zene szünetel"}</p>
    <div className="flex flex-wrap gap-2"><button className="rounded-lg bg-amber-400 px-3 py-2 text-black" onClick={preview}>DJ hangpróba</button>{dj.current && <button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={()=>void dj.next().catch(()=>{})}>Következő</button>}<button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={stop}>Zene leállítása</button></div>
    <div className="flex flex-wrap gap-2" aria-label="DJ hangulatpróba">{(Object.keys(DJ_MOODS) as DjMood[]).map(mood => <button key={mood} disabled={!dj.adaptive} aria-pressed={dj.mood === mood} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm disabled:opacity-40" onClick={() => dj.cue(mood)}>{DJ_MOODS[mood].label}</button>)}</div>
    <label className="block">Hangerő<input aria-label="Zene hangerő" className="block w-full" type="range" min={0} max={1} step={0.05} value={volume} onChange={e => setVolume(Number(e.target.value))} /></label>
    <p className="text-xs text-zinc-400">Beszéd közben a feltöltött zene finoman lehalkul, utána visszaerősödik.</p>
    <label className="block">Zenék hozzáadása<input className="mt-2 block w-full" type="file" accept="audio/*" multiple disabled={dj.loading} onChange={e => { void dj.add(Array.from(e.target.files || [])); e.target.value = ""; }} /></label>
    <p className="text-xs text-zinc-400">A fájlokat és a választott hangulatokat ez a böngésző megőrzi a következő megnyitásra. Másik eszközre nem kerülnek át. Maximum 30 szám, fájlonként 100 MB.</p>
    {dj.loading && <p className="text-sm">Zenetár betöltése…</p>}
    {!dj.loading && dj.tracks.length === 0 && <p className="text-sm text-amber-200">Ezen a böngészőn még nincs feltöltött zene.</p>}
    {dj.tracks.map(track => <div key={track.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-900 p-3">
      <span className="min-w-0 flex-1 break-words text-sm">{track.title}{dj.played.has(track.id) ? " • ebben a körben elhangzott" : ""}</span>
      <select aria-label={`${track.title} hangulata`} className="rounded-lg bg-zinc-800 p-2 text-sm" value={track.mood} onChange={e => void dj.tag(track.id, e.target.value as MusicTrack["mood"])}><option value="any">Bármelyik hangulathoz</option>{(Object.keys(DJ_MOODS) as DjMood[]).map(mood => <option key={mood} value={mood}>{DJ_MOODS[mood].label}</option>)}</select>
      <button disabled={dj.played.has(track.id)} className="rounded-lg border border-zinc-600 px-3 py-2 text-sm disabled:opacity-40" onClick={() => void play(track)}>Lejátszás</button>
      <button aria-label={`${track.title} törlése`} className="px-2 text-sm text-zinc-400" onClick={() => void dj.remove(track.id)}>Törlés</button>
    </div>)}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRequests} onChange={e => setAutoRequests(e.target.checked)} />!zene pontos cím – automatikus zenekérés</label>
    {requests.length > 0 && <div className="space-y-1"><p className="text-sm font-semibold">Legutóbbi zenekérések</p>{requests.slice(-5).map((request, index) => {
      const normalize = (text:string) => text.toLocaleLowerCase("hu").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
      const matches = dj.tracks.filter(track=>normalize(track.title)===normalize(request.title));
      return <div className="flex gap-2 text-sm text-zinc-400" key={index}><span>{request.user}: {request.title}</span>{matches.length===1?<button disabled={dj.played.has(matches[0].id)} onClick={()=>void play(matches[0])}>Lejátszás</button>:<span>Még nincs betöltve</span>}</div>;
    })}</div>}
  </section>;
}
