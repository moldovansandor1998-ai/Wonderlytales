import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge, statusTone, Table } from "@/components/ui";
import type { ShotRow, Animation, ContinuityState, QcResult, Character, CharacterVersion, Location, LocationVersion, Prop, PropVersion, RenderJob } from "@/lib/types";
import type { ShotData } from "@/lib/schemas/shot";
import { previewShotAction, approveShotAction, rejectShotAction, finalRenderAction, lockShotAction, saveShotAction } from "@/lib/actions";
import { diffContinuity, stateFromShot } from "@/lib/continuity";
import { ShotEditor } from "./ShotEditor";
import { notFound } from "next/navigation";

function ActionBtn({ label, action, color = "bg-zinc-700 hover:bg-zinc-600", confirm }: { label: string; action: () => Promise<void>; color?: string; confirm?: boolean }) {
  return <form action={action}>{confirm
    ? <button className={`px-3 py-2 rounded text-sm font-semibold min-h-[44px] md:min-h-0 ${color}`} formAction={async () => { "use server"; await action(); }}>{label}</button>
    : <button className={`px-3 py-2 rounded text-sm font-semibold min-h-[44px] md:min-h-0 ${color}`}>{label}</button>}</form>;
}

export default async function ShotPage({ params }: { params: { id: string } }) {
  const db = await getDb();
  const shot = await db.get<ShotRow>("shots", params.id);
  if (!shot) notFound();
  const [anims, chars, locs, props, charVersions, locVersions, propVersions] = await Promise.all([
    db.list<Animation>("animations"), db.list<Character>("characters"), db.list<Location>("locations"), db.list<Prop>("props"),
    db.list<CharacterVersion>("character_versions"), db.list<LocationVersion>("location_versions"), db.list<PropVersion>("prop_versions"),
  ]);
  const jobs = (await db.find<RenderJob>("render_jobs", (j) => j.shot_id === shot.id)).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const lastVideo = jobs.find((j) => j.status === "SUCCEEDED" && j.output_path)?.output_path;
  const states = await db.find<ContinuityState>("continuity_states", (c) => c.shot_id === shot.id);
  const output = states.find((s) => s.kind === "OUTPUT");
  const siblings = (await db.find<ShotRow>("shots", (s) => s.scene_id === shot.scene_id)).sort((a,b) => a.shot_number - b.shot_number);
  const idx = siblings.findIndex((s) => s.id === shot.id);
  let warnings: { field: string; message: string; severity: string }[] = [];
  if (idx > 0) {
    const prevOut = (await db.find<ContinuityState>("continuity_states", (c) => c.shot_id === siblings[idx-1].id && c.kind === "OUTPUT"))[0];
    warnings = diffContinuity(prevOut?.state ?? null, output?.state ?? stateFromShot(shot.data));
  }
  const qcs = (await db.find<QcResult>("qc_results", (q) => q.shot_id === shot.id)).slice(-15);
  const locked = shot.status === "LOCKED";
  const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id.slice(0,8);
  const save = async (data: ShotData) => { "use server"; await saveShotAction(shot.id, data); };
  return (<>
    <PageTitle title={`SH${String(shot.shot_number).padStart(3,"0")} · revision ${shot.revision}`} sub={`Státusz: ${shot.status}`} />
    <div className="flex gap-2 mb-6 flex-wrap">
      <ActionBtn label="GENERATE PREVIEW" action={previewShotAction.bind(null, shot.id)} color="bg-sky-600 hover:bg-sky-500" />
      <ActionBtn label="APPROVE" action={approveShotAction.bind(null, shot.id)} color="bg-emerald-600 hover:bg-emerald-500" />
      <ActionBtn label="REJECT" action={rejectShotAction.bind(null, shot.id)} color="bg-red-700 hover:bg-red-600" />
      <ActionBtn label="RENDER AGAIN" action={previewShotAction.bind(null, shot.id)} />
      <ActionBtn label="FINAL RENDER" action={finalRenderAction.bind(null, shot.id)} color="bg-violet-600 hover:bg-violet-500" />
      {shot.status === "FINAL_READY" && <ActionBtn label="LOCK" action={lockShotAction.bind(null, shot.id)} />}
    </div>
    {lastVideo && <Card className="mb-6"><h2 className="font-semibold mb-2">Utolsó render output</h2><p className="font-mono text-xs text-zinc-400">{lastVideo}</p></Card>}
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2"><h2 className="font-semibold mb-3">Shot Editor</h2>
        <ShotEditor initial={shot.data} locked={locked} onSave={save} options={{
          animations: anims.map((a) => a.code),
          characters: chars.map((c) => ({ id: c.id, name: c.name, versions: charVersions.filter((v) => v.character_id === c.id).sort((a,b)=>b.version.localeCompare(a.version)).map((v) => ({ id: v.id, version: v.version, asset_id: v.asset_id, costumes: v.costumes })) })),
          locations: locs.map((l) => ({ id: l.id, name: l.name, versions: locVersions.filter((v) => v.location_id === l.id).map((v) => ({ version: v.version, asset_id: v.asset_id })), variants: l.variants })),
          props: props.map((p) => ({ id: p.id, name: p.name, versions: propVersions.filter((v) => v.prop_id === p.id).map((v) => ({ version: v.version, asset_id: v.asset_id })), states: p.allowed_states })),
        }} />
      </Card>
      <div className="space-y-6">
        <Card><h2 className="font-semibold mb-3">Continuity (Previous → Current)</h2>
          {warnings.length === 0 ? <p className="text-sm text-emerald-400">Nincs eltérés vagy ez az első shot.</p> :
            <ul className="text-sm space-y-1">{warnings.map((w, i) => <li key={i} className={w.severity === "ERROR" ? "text-red-400" : "text-amber-300"}>⚠ {w.message}</li>)}</ul>}
          {output && <div className="mt-3 text-xs text-zinc-400">
            <div>Napszak: {output.state.environment.time_of_day} · Időjárás: {output.state.environment.weather}</div>
            <div className="mt-1">{output.state.characters.map((c) => <div key={c.character_id}>{nameOf(c.character_id)}: {c.emotion}, ruha: {c.costume_id ?? "–"}</div>)}</div>
          </div>}
        </Card>
        <Card><h2 className="font-semibold mb-3">QC eredmények</h2>
          {qcs.length === 0 ? <p className="text-sm text-zinc-500">Még nem futott QC.</p> :
            <Table head={["Check","Státusz","Score"]}>{qcs.map((q) => <tr key={q.id}><td className="text-xs">{q.check}</td><td><Badge text={q.status} tone={statusTone(q.status)} /></td><td>{q.score}</td></tr>)}</Table>}
        </Card>
        <Card><h2 className="font-semibold mb-2">Dialógus</h2>
          {shot.data.dialogue.length === 0 ? <p className="text-sm text-zinc-500">Nincs dialógus.</p> :
            <ul className="text-sm space-y-1">{shot.data.dialogue.map((d) => <li key={d.dialogue_line_id}><strong>{nameOf(d.character_id)}:</strong> „{d.text}”</li>)}</ul>}
        </Card>
      </div>
    </div>
  </>);
}
