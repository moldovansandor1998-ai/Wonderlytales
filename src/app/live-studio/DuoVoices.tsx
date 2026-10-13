"use client";
import { CAST, type CastVoices, type Speaker } from "@/lib/live/duo";
const field = "block w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2";
export default function DuoVoices({ voices, options, disabled, onChange, onTest }: { voices: CastVoices; options: {id: string; name: string}[]; disabled: boolean; onChange: (speaker: Speaker, id: string) => void; onTest: (speaker: Speaker) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{(["ali", "isti"] as const).map(speaker => <div key={speaker} className="space-y-2 rounded-xl border border-violet-900 bg-violet-950/20 p-3">
    <h3 className="font-semibold">{CAST[speaker].name} <span className="text-xs font-normal text-zinc-400">{speaker === "ali" ? "a boszorkány" : "a duzzogó kalóz"}</span></h3>
    {options.length ? <label className="block text-sm">{CAST[speaker].name} hangja<select className={field} disabled={disabled} value={voices[speaker]} onChange={e => onChange(speaker, e.target.value)}><option value="">Válassz hangot</option>{!options.some(v => v.id === voices[speaker]) && voices[speaker] && <option value={voices[speaker]}>Mentett hang</option>}{options.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label> : <p className="text-sm text-amber-200">ElevenLabs: {voices[speaker] === CAST[speaker].voiceId ? CAST[speaker].voiceName : "egyéni hang"}</p>}
    <details><summary className="cursor-pointer text-xs text-zinc-400">Voice ID szerkesztése</summary><input aria-label={`${CAST[speaker].name} Voice ID`} className={`${field} mt-2 text-xs`} disabled={disabled} maxLength={100} value={voices[speaker]} onChange={e => onChange(speaker, e.target.value.replace(/[^a-zA-Z0-9]/g, ""))} /></details>
    <button className="rounded-lg border border-violet-400 px-3 py-2 text-sm disabled:opacity-40" disabled={disabled} onClick={() => onTest(speaker)}>{CAST[speaker].name} hangpróba</button>
  </div>)}</div>;
}
