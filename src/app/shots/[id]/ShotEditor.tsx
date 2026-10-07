"use client";
import { useState } from "react";
import type { ShotData } from "@/lib/schemas/shot";

const EMOTIONS = ["neutral","happy","sad","angry","fear","surprise","excited","curious"];
const SHOT_TYPES = ["EXTREME_WIDE","WIDE","MEDIUM_WIDE","MEDIUM","MEDIUM_CLOSE","CLOSE_UP","EXTREME_CLOSE_UP","OVER_SHOULDER","POV","AERIAL"];
const MOVES = ["STATIC","PAN","TILT","DOLLY_IN","DOLLY_OUT","TRUCK","CRANE","HANDHELD","ORBIT"];
const LIGHTS = ["DAY","NIGHT","SUNSET","RAIN","WINTER","INTERIOR","MAGICAL"];
const QC_ALL = ["ASSET_VERSION","CHARACTER","COSTUME","LOCATION","PROP_CONTINUITY","CLIPPING","CAMERA","EYE_DIRECTION","LIPSYNC","FACIAL_ANIMATION","BODY_ANIMATION","AUDIO","RENDER_CORRUPTION","STORY_CONTINUITY","STATIC_SHOT"];
const VFX_MODES = ["BLENDER","BLENDER_PLUS_VFX","GENERATIVE_VIDEO","COMPOSITE"];

interface Opts {
  animations: string[];
  characters: { id: string; name: string; versions: { id: string; version: string; asset_id: string; costumes: string[] }[] }[];
  locations: { id: string; name: string; versions: { version: string; asset_id: string }[]; variants: string[] }[];
  props: { id: string; name: string; versions: { version: string; asset_id: string }[]; states: string[] }[];
}

function Vec3Input({ label, value, disabled, onChange }: { label: string; value: [number,number,number]; disabled: boolean; onChange: (v: [number,number,number]) => void }) {
  return (
    <div><label>{label}</label>
      <div className="flex gap-1">
        {(["X","Y","Z"] as const).map((axis, i) => (
          <input key={axis} type="number" step="0.1" disabled={disabled} value={value[i]}
            onChange={(e) => { const v = [...value] as [number,number,number]; v[i] = Number(e.target.value); onChange(v); }}
            className="w-full" placeholder={axis} />
        ))}
      </div>
    </div>
  );
}

export function ShotEditor({ initial, locked, options, onSave }: { initial: ShotData; locked: boolean; options: Opts; onSave: (d: ShotData) => Promise<void> }) {
  const [d, setD] = useState<ShotData>(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ShotData>) => setD({ ...d, ...patch });

  async function save() {
    setBusy(true); setMsg("");
    try { await onSave(d); setMsg("Új revision mentve."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Hiba a mentésnél"); }
    finally { setBusy(false); }
  }

  const charOpt = (id: string) => options.characters.find((c) => c.id === id);
  const locOpt = (id: string) => options.locations.find((l) => l.id === id);
  const propOpt = (id: string) => options.props.find((p) => p.id === id);

  function addCharacter() {
    const c = options.characters[0];
    if (!c) return;
    const v = c.versions[0];
    set({ characters: [...d.characters, { character_id: c.id, asset_id: v?.asset_id ?? "", asset_version: v?.version ?? "V001", costume_id: "default", position: [0,0,0], rotation: [0,0,0], animation_code: null, emotion: "neutral", look_at: null }] });
  }
  function addProp() {
    const p = options.props[0];
    if (!p) return;
    const v = p.versions[0];
    set({ props: [...d.props, { prop_id: p.id, asset_id: v?.asset_id ?? "", asset_version: v?.version ?? "V001", state: p.states[0] ?? "DEFAULT" }] });
  }
  function addDialogue() {
    const c = d.characters[0];
    if (!c) return;
    set({ dialogue: [...d.dialogue, { dialogue_line_id: crypto.randomUUID(), character_id: c.character_id, text: "", language: "hu" }] });
  }

  return (
    <div className="space-y-5">
      {msg && <div className={`text-sm rounded p-2 ${msg.includes("hiba") || msg.includes("Hiba") || msg.includes("LOCKED") ? "bg-red-950/40 border border-red-800 text-red-300" : "bg-emerald-950/40 border border-emerald-800 text-emerald-300"}`}>{msg}</div>}
      {locked && <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm">A shot LOCKED – a szerkesztéshez oldd fel a státuszt (REJECT) vagy duplikáld új shotként.</div>}

      <section>
        <h3 className="text-sm font-semibold mb-2 text-zinc-300">Alapok</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><label>Időtartam (mp)</label><input type="number" step="0.5" disabled={locked} value={d.duration_sec} onChange={(e) => set({ duration_sec: Number(e.target.value) })} /></div>
          <div><label>Helyszín</label>
            <select disabled={locked} value={d.location.location_id} onChange={(e) => { const l = locOpt(e.target.value); const v = l?.versions[0]; set({ location: { ...d.location, location_id: e.target.value, asset_id: v?.asset_id ?? d.location.asset_id, asset_version: v?.version ?? d.location.asset_version } }); }}>
              {options.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select></div>
          <div><label>Helyszín verzió</label>
            <select disabled={locked} value={d.location.asset_version} onChange={(e) => { const l = locOpt(d.location.location_id); const v = l?.versions.find((x) => x.version === e.target.value); set({ location: { ...d.location, asset_version: e.target.value, asset_id: v?.asset_id ?? d.location.asset_id } }); }}>
              {(locOpt(d.location.location_id)?.versions ?? []).map((v) => <option key={v.version} value={v.version}>{v.version} ({v.asset_id})</option>)}
            </select></div>
          <div><label>Variáns</label>
            <select disabled={locked} value={d.location.variant} onChange={(e) => set({ location: { ...d.location, variant: e.target.value } })}>
              {(locOpt(d.location.location_id)?.variants ?? ["DAY"]).map((v) => <option key={v}>{v}</option>)}
            </select></div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-semibold text-zinc-300">Karakterek ({d.characters.length})</h3>
          {!locked && <button onClick={addCharacter} className="px-2 py-1 rounded bg-zinc-700 text-xs min-h-[32px]">+ Karakter</button>}</div>
        {d.characters.map((c, i) => (
          <div key={i} className="rounded border border-zinc-800 p-3 mb-2 space-y-2">
            <div className="flex justify-between items-center">
              <select disabled={locked} value={c.character_id} className="max-w-[200px]" onChange={(e) => {
                const oc = charOpt(e.target.value); const v = oc?.versions[0];
                const a = [...d.characters]; a[i] = { ...c, character_id: e.target.value, asset_id: v?.asset_id ?? c.asset_id, asset_version: v?.version ?? c.asset_version }; set({ characters: a });
              }}>{options.characters.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              {!locked && <button onClick={() => set({ characters: d.characters.filter((_, j) => j !== i) })} className="text-xs text-red-400 hover:underline min-h-[32px]">Törlés</button>}
            </div>
            <div className="grid md:grid-cols-4 gap-2">
              <div><label>Verzió</label>
                <select disabled={locked} value={c.asset_version} onChange={(e) => { const v = charOpt(c.character_id)?.versions.find((x) => x.version === e.target.value); const a=[...d.characters]; a[i]={...c, asset_version:e.target.value, asset_id:v?.asset_id ?? c.asset_id}; set({characters:a}); }}>
                  {(charOpt(c.character_id)?.versions ?? []).map((v) => <option key={v.version} value={v.version}>{v.version}</option>)}
                </select></div>
              <div><label>Costume</label>
                <select disabled={locked} value={c.costume_id ?? "default"} onChange={(e) => { const a=[...d.characters]; a[i]={...c, costume_id:e.target.value}; set({characters:a}); }}>
                  {(charOpt(c.character_id)?.versions.find((v)=>v.version===c.asset_version)?.costumes ?? ["default"]).map((x) => <option key={x}>{x}</option>)}
                </select></div>
              <div><label>Animáció</label>
                <select disabled={locked} value={c.animation_code ?? ""} onChange={(e) => { const a=[...d.characters]; a[i]={...c, animation_code:e.target.value||null}; set({characters:a}); }}>
                  <option value="">–</option>{options.animations.map((x) => <option key={x}>{x}</option>)}
                </select></div>
              <div><label>Emóció</label>
                <select disabled={locked} value={c.emotion} onChange={(e) => { const a=[...d.characters]; a[i]={...c, emotion:e.target.value as typeof c.emotion}; set({characters:a}); }}>{EMOTIONS.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              <Vec3Input label="Pozíció" value={c.position} disabled={locked} onChange={(v) => { const a=[...d.characters]; a[i]={...c, position:v}; set({characters:a}); }} />
              <Vec3Input label="Rotáció" value={c.rotation} disabled={locked} onChange={(v) => { const a=[...d.characters]; a[i]={...c, rotation:v}; set({characters:a}); }} />
              <div><label>Look at target</label>
                <select disabled={locked} value={c.look_at ?? ""} onChange={(e) => { const a=[...d.characters]; a[i]={...c, look_at:e.target.value||null}; set({characters:a}); }}>
                  <option value="">–</option>
                  {d.characters.filter((_, j) => j !== i).map((oc, j) => <option key={j} value={oc.character_id}>{options.characters.find((x)=>x.id===oc.character_id)?.name}</option>)}
                  <option value="CAMERA">Kamera</option>
                </select></div>
            </div>
          </div>))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-semibold text-zinc-300">Propok ({d.props.length})</h3>
          {!locked && <button onClick={addProp} className="px-2 py-1 rounded bg-zinc-700 text-xs min-h-[32px]">+ Prop</button>}</div>
        {d.props.map((p, i) => (
          <div key={i} className="rounded border border-zinc-800 p-2 mb-2 flex gap-2 items-end flex-wrap">
            <div><label>Prop</label>
              <select disabled={locked} value={p.prop_id} onChange={(e) => { const op = propOpt(e.target.value); const v = op?.versions[0]; const a=[...d.props]; a[i]={...p, prop_id:e.target.value, asset_id:v?.asset_id ?? p.asset_id, asset_version:v?.version ?? p.asset_version}; set({props:a}); }}>
                {options.props.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select></div>
            <div><label>State</label>
              <select disabled={locked} value={p.state} onChange={(e) => { const a=[...d.props]; a[i]={...p, state:e.target.value}; set({props:a}); }}>
                {(propOpt(p.prop_id)?.states ?? ["DEFAULT"]).map((x) => <option key={x}>{x}</option>)}
              </select></div>
            {!locked && <button onClick={() => set({ props: d.props.filter((_, j) => j !== i) })} className="text-xs text-red-400 hover:underline min-h-[32px]">Törlés</button>}
          </div>))}
      </section>

      <section>
        <div className="flex justify-between items-center mb-2"><h3 className="text-sm font-semibold text-zinc-300">Dialógus ({d.dialogue.length})</h3>
          {!locked && d.characters.length > 0 && <button onClick={addDialogue} className="px-2 py-1 rounded bg-zinc-700 text-xs min-h-[32px]">+ Sor</button>}</div>
        {d.dialogue.map((dl, i) => (
          <div key={i} className="rounded border border-zinc-800 p-2 mb-2 flex gap-2 items-end">
            <div><label>Karakter</label>
              <select disabled={locked} value={dl.character_id} onChange={(e) => { const a=[...d.dialogue]; a[i]={...dl, character_id:e.target.value}; set({dialogue:a}); }}>
                {d.characters.map((c, j) => <option key={j} value={c.character_id}>{options.characters.find((x)=>x.id===c.character_id)?.name}</option>)}
              </select></div>
            <div className="flex-1"><label>Szöveg (HU master)</label><input disabled={locked} value={dl.text} onChange={(e) => { const a=[...d.dialogue]; a[i]={...dl, text:e.target.value}; set({dialogue:a}); }} /></div>
            {!locked && <button onClick={() => set({ dialogue: d.dialogue.filter((_, j) => j !== i) })} className="text-xs text-red-400 hover:underline min-h-[32px]">Törlés</button>}
          </div>))}
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 text-zinc-300">Kamera és világítás</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><label>Shot type</label><select disabled={locked} value={d.camera.shot_type} onChange={(e) => set({ camera: { ...d.camera, shot_type: e.target.value as ShotData["camera"]["shot_type"] } })}>{SHOT_TYPES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Objektív (mm)</label><input type="number" min="8" max="200" disabled={locked} value={d.camera.lens_mm} onChange={(e) => set({ camera: { ...d.camera, lens_mm: Number(e.target.value) } })} /></div>
          <div><label>Movement</label><select disabled={locked} value={d.camera.movement} onChange={(e) => set({ camera: { ...d.camera, movement: e.target.value as ShotData["camera"]["movement"] } })}>{MOVES.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Camera target</label><input disabled={locked} value={d.camera.target ?? ""} onChange={(e) => set({ camera: { ...d.camera, target: e.target.value || null } })} placeholder="karakter/prop asset_id" /></div>
          <div><label>Világítás preset</label><select disabled={locked} value={d.lighting.preset} onChange={(e) => set({ lighting: { ...d.lighting, preset: e.target.value as ShotData["lighting"]["preset"] } })}>{LIGHTS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Napszak (óó:pp)</label><input disabled={locked} value={d.lighting.time_of_day} onChange={(e) => set({ lighting: { ...d.lighting, time_of_day: e.target.value } })} /></div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold mb-2 text-zinc-300">Audio / VFX / Render / QC</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><label>Music cue</label><input disabled={locked} value={d.audio.music_cue ?? ""} onChange={(e) => set({ audio: { ...d.audio, music_cue: e.target.value || null } })} /></div>
          <div><label>Ambience</label><input disabled={locked} value={d.audio.ambience ?? ""} onChange={(e) => set({ audio: { ...d.audio, ambience: e.target.value || null } })} /></div>
          <div><label>SFX (vesszővel)</label><input disabled={locked} value={d.audio.sfx.join(",")} onChange={(e) => set({ audio: { ...d.audio, sfx: e.target.value.split(",").map((x)=>x.trim()).filter(Boolean) } })} /></div>
          <div><label>VFX mód</label><select disabled={locked} value={d.vfx.mode} onChange={(e) => set({ vfx: { ...d.vfx, mode: e.target.value as ShotData["vfx"]["mode"] } })}>{VFX_MODES.map((x) => <option key={x}>{x}</option>)}</select></div>
          {d.vfx.mode !== "BLENDER" && <>
            <div><label>VFX provider</label><input disabled={locked} value={d.vfx.provider ?? ""} onChange={(e) => set({ vfx: { ...d.vfx, provider: e.target.value || null } })} placeholder="mock / remote" /></div>
            <div><label>VFX max költség (USD)</label><input type="number" step="0.1" disabled={locked} value={d.vfx.max_cost_usd} onChange={(e) => set({ vfx: { ...d.vfx, max_cost_usd: Number(e.target.value) } })} /></div>
          </>}
          <div><label>Megjelenés</label><select disabled={locked} value={d.render.visual_style ?? "TECHNICAL_PROXY"} onChange={(e) => set({ render: { ...d.render, visual_style: e.target.value as ShotData["render"]["visual_style"] } })}><option value="TECHNICAL_PROXY">Technikai előnézet</option><option value="STORYBOOK_DRAFT_V003">Mesés erdő – Márk és Lili karakterpróba</option><option value="STORYBOOK_DRAFT_V002">Korábbi karakterpróba (V002)</option></select></div>
          <div><label>Render engine</label><select disabled={locked} value={d.render.engine} onChange={(e) => set({ render: { ...d.render, engine: e.target.value as ShotData["render"]["engine"] } })}>{["BLENDER_EEVEE","BLENDER_CYCLES","MOCK"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Minőség</label><select disabled={locked} value={d.render.quality} onChange={(e) => set({ render: { ...d.render, quality: e.target.value as ShotData["render"]["quality"] } })}><option>PREVIEW</option><option>FINAL</option></select></div>
          <div><label>FPS</label><input type="number" disabled={locked} value={d.render.fps} onChange={(e) => set({ render: { ...d.render, fps: Number(e.target.value) } })} /></div>
          <div><label>Prioritás (0-100)</label><input type="number" min="0" max="100" disabled={locked} value={d.render.priority} onChange={(e) => set({ render: { ...d.render, priority: Number(e.target.value) } })} /></div>
          <div><label>QC min. score</label><input type="number" min="0" max="100" disabled={locked} value={d.qc.minimum_score} onChange={(e) => set({ qc: { ...d.qc, minimum_score: Number(e.target.value) } })} /></div>
          <div><label>Költségkeret (USD)</label><input type="number" step="0.1" disabled={locked} value={d.cost.estimated_usd} onChange={(e) => set({ cost: { ...d.cost, estimated_usd: Number(e.target.value) } })} /></div>
        </div>
        <div className="mt-2"><label>QC kötelező checkek</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {QC_ALL.map((c) => (
              <label key={c} className={`px-2 py-1 rounded text-xs cursor-pointer border ${d.qc.required_checks.includes(c) ? "border-amber-500 bg-amber-900/30" : "border-zinc-700"}`}>
                <input type="checkbox" className="hidden" disabled={locked} checked={d.qc.required_checks.includes(c)}
                  onChange={(e) => set({ qc: { ...d.qc, required_checks: e.target.checked ? [...d.qc.required_checks, c] : d.qc.required_checks.filter((x) => x !== c) } })} />
                {c}
              </label>))}
          </div>
        </div>
      </section>

      {!locked && <button onClick={save} disabled={busy} className="px-4 py-2.5 rounded bg-amber-500 text-zinc-950 font-semibold text-sm min-h-[44px]">{busy ? "Mentés…" : "SAVE REVISION"}</button>}
    </div>
  );
}
