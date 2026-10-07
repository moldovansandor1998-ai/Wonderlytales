import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge, statusTone, SubmitButton, Table } from "@/components/ui";
import type { Episode, Scene, ShotRow, Location, EpisodeLocalization } from "@/lib/types";
import { createSceneAction, createShotAction, updateEpisodeAction, deleteEpisodeAction, archiveEpisodeAction, updateSceneAction, reorderSceneAction, reorderShotAction, duplicateShotAction } from "@/lib/actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EpisodeDetail({ params }: { params: { id: string } }) {
  const db = await getDb();
  const ep = await db.get<Episode>("episodes", params.id);
  if (!ep) notFound();
  const scenes = (await db.find<Scene>("scenes", (s) => s.episode_id === ep.id)).sort((a,b) => a.number - b.number);
  const shots = await db.list<ShotRow>("shots");
  const locs = await db.list<Location>("locations");
  const localizations = await db.find<EpisodeLocalization>("episode_localizations", (l) => l.episode_id === ep.id);
  return (<>
    <PageTitle title={`E${String(ep.number).padStart(2,"0")} – ${ep.title}`} sub={ep.brief} />
    <Link className="text-amber-400 block mb-4" href={`/episodes/${ep.id}/audio`}>Magyar szinkron és hangfelvételek</Link>
    <Card className="mb-4"><details><summary className="font-semibold cursor-pointer text-sm">Epizód szerkesztése</summary>
      <form action={updateEpisodeAction.bind(null, ep.id, ep.season_id)} className="grid md:grid-cols-3 gap-3 mt-3">
        <div><label>Szám</label><input name="number" type="number" defaultValue={ep.number} /></div>
        <div className="md:col-span-2"><label>Cím</label><input name="title" defaultValue={ep.title} /></div>
        <div><label>Státusz</label><select name="status" defaultValue={ep.status}><option>DRAFT</option><option>IN_PRODUCTION</option><option>REVIEW</option><option>DONE</option><option>ARCHIVED</option></select></div>
        <div><label>Célhossz (mp)</label><input name="target_duration_sec" type="number" defaultValue={ep.target_duration_sec} /></div>
        <div><label>Script verzió</label><input name="script_version" defaultValue={ep.script_version} /></div>
        <div className="md:col-span-3"><label>Brief</label><textarea name="brief" defaultValue={ep.brief} rows={2} /></div>
        <input type="hidden" name="master_language" defaultValue={ep.master_language} value={ep.master_language} />
        <div className="flex items-end gap-3"><SubmitButton label="Mentés" />
          <button formAction={archiveEpisodeAction.bind(null, ep.id, ep.season_id)} className="text-sm text-amber-400 hover:underline min-h-[44px]">Archiválás</button>
          <button formAction={deleteEpisodeAction.bind(null, ep.id, ep.season_id)} className="text-sm text-red-400 hover:underline min-h-[44px]" formNoValidate>Törlés</button>
        </div>
      </form></details></Card>
    <div className="flex gap-2 mb-6 flex-wrap">
      <Badge text={ep.status} tone={statusTone(ep.status)} />
      <Badge text={`Master: ${ep.master_language.toUpperCase()}`} tone="blue" />
      <Badge text={ep.script_version} />
      {localizations.sort((a,b)=>a.language.localeCompare(b.language)).map((l) => <Badge key={l.id} text={`${l.language.toUpperCase()} ${l.status}`} tone={statusTone(l.status)} />)}
    </div>
    <Card className="mb-6"><h2 className="font-semibold mb-2">Mentett epizódterv</h2>
      <p className="text-sm text-zinc-300">{scenes.length} jelenet · {shots.filter((shot) => scenes.some((scene) => scene.id === shot.scene_id)).length} shot</p>
      <p className="mt-2 text-xs text-zinc-400">Célhossz: {Math.round(ep.target_duration_sec / 60)} perc. A tényleges játékidőt az animáció időzítése és a renderelt felvételek határozzák meg.</p>
    </Card>
    {scenes.map((sc) => (
      <Card key={sc.id} className="mb-4">
        <div className="flex items-center gap-3 mb-2 flex-wrap"><h2 className="font-semibold">Scene {sc.number} – {sc.title}</h2><span className="text-xs text-zinc-500">{locs.find((l) => l.id === sc.location_id)?.name}</span>
          <form action={reorderSceneAction.bind(null, sc.id, ep.id, "up")}><button className="text-xs text-zinc-400 hover:text-white min-h-[32px]">↑</button></form>
          <form action={reorderSceneAction.bind(null, sc.id, ep.id, "down")}><button className="text-xs text-zinc-400 hover:text-white min-h-[32px]">↓</button></form>
          <details className="text-xs"><summary className="cursor-pointer text-zinc-400 hover:text-white">szerkesztés</summary>
            <form action={updateSceneAction.bind(null, sc.id, ep.id)} className="grid md:grid-cols-4 gap-2 mt-2">
              <div><label>Szám</label><input name="number" type="number" defaultValue={sc.number} /></div>
              <div><label>Cím</label><input name="title" defaultValue={sc.title} /></div>
              <div><label>Helyszín</label><select name="location_id"><option value="">–</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div className="flex items-end"><SubmitButton label="Mentés" /></div>
              <div className="md:col-span-4"><label>Összefoglaló</label><textarea name="summary" defaultValue={sc.summary} rows={1} /></div>
            </form></details></div>
        <p className="text-sm text-zinc-400 mb-3">{sc.summary}</p>
        <Table head={["Shot","Rev","Időtartam","Státusz","Karakterek","Kamera","Műveletek"]}>
          {shots.filter((s) => s.scene_id === sc.id).sort((a,b)=>a.shot_number-b.shot_number).map((s) => (
            <tr key={s.id}>
              <td><Link className="text-amber-400 hover:underline" href={`/shots/${s.id}`}>SH{String(s.shot_number).padStart(3,"0")}</Link></td>
              <td>r{s.revision}</td><td>{s.data.duration_sec}s</td>
              <td><Badge text={s.status} tone={statusTone(s.status)} /></td>
              <td>{s.data.characters.length}</td><td className="text-xs">{s.data.camera.shot_type} / {s.data.camera.movement}</td>
              <td className="whitespace-nowrap">
                <form action={reorderShotAction.bind(null, s.id, sc.id, "up")} className="inline"><button className="text-xs text-zinc-400 hover:text-white px-1 min-h-[32px]">↑</button></form>
                <form action={reorderShotAction.bind(null, s.id, sc.id, "down")} className="inline"><button className="text-xs text-zinc-400 hover:text-white px-1 min-h-[32px]">↓</button></form>
                <form action={duplicateShotAction.bind(null, s.id)} className="inline"><button className="text-xs text-amber-400 hover:underline px-1 min-h-[32px]">Duplikálás</button></form>
              </td>
            </tr>))}
        </Table>
        <form action={createShotAction} className="flex gap-3 mt-3 items-end flex-wrap">
          <input type="hidden" name="scene_id" value={sc.id} />
          <div><label>Helyszín</label><select name="location_id">{locs.map((l) => <option key={l.id} value={l.id} selected={l.id === sc.location_id}>{l.name}</option>)}</select></div>
          <div><label>Időtartam (mp)</label><input name="duration_sec" type="number" defaultValue="5" className="w-24" /></div>
          <SubmitButton label="+ Új shot" />
        </form>
      </Card>
    ))}
    <Card><h2 className="font-semibold mb-3">Új jelenet</h2>
      <form action={createSceneAction} className="grid md:grid-cols-4 gap-3">
        <input type="hidden" name="episode_id" value={ep.id} />
        <div><label>Szám</label><input name="number" type="number" required /></div>
        <div className="md:col-span-2"><label>Cím</label><input name="title" required /></div>
        <div><label>Helyszín</label><select name="location_id"><option value="">–</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div className="md:col-span-4"><label>Összefoglaló</label><textarea name="summary" rows={2} /></div>
        <div><SubmitButton label="Jelenet létrehozása" /></div>
      </form></Card>
  </>);
}
