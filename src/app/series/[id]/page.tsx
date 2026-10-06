import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge, statusTone, SubmitButton, Table } from "@/components/ui";
import type { Series, Season, Episode } from "@/lib/types";
import { createSeasonAction, createEpisodeAction, updateSeriesAction, archiveSeriesAction } from "@/lib/actions";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SeriesDetail({ params }: { params: { id: string } }) {
  const db = await getDb();
  const series = await db.get<Series>("series", params.id);
  if (!series) notFound();
  const seasons = (await db.find<Season>("seasons", (s) => s.series_id === series.id)).sort((a,b) => a.number - b.number);
  const episodes = await db.list<Episode>("episodes");
  return (<>
    <PageTitle title={`${series.name} / ${series.international_name}`} sub={series.visual_style} />
    <Card className="mb-6"><h2 className="font-semibold mb-3">Sorozat szerkesztése</h2>
      <form action={updateSeriesAction.bind(null, series.id)} className="grid md:grid-cols-3 gap-3">
        <div><label>Név</label><input name="name" defaultValue={series.name} required /></div>
        <div><label>International</label><input name="international_name" defaultValue={series.international_name} /></div>
        <div><label>Státusz</label><select name="status" defaultValue={series.status}><option>ACTIVE</option><option>ARCHIVED</option></select></div>
        <div><label>Korosztály</label><input name="age_range" defaultValue={series.age_range} /></div>
        <div><label>FPS</label><input name="fps" type="number" defaultValue={series.fps} /></div>
        <div><label>Felbontás</label><input name="resolution" defaultValue={series.resolution} /></div>
        <div className="md:col-span-2"><label>Vizuális stílus</label><input name="visual_style" defaultValue={series.visual_style} /></div>
        <div><label>Bible</label><textarea name="bible" defaultValue={series.bible} rows={1} /></div>
        <div className="flex items-end gap-3"><SubmitButton label="Mentés" />
          {series.status !== "ARCHIVED" && <button formAction={archiveSeriesAction.bind(null, series.id)} className="text-sm text-red-400 hover:underline min-h-[44px]">Archiválás</button>}
        </div>
      </form></Card>
    <Card className="mb-6"><h2 className="font-semibold mb-2">Bible</h2><p className="text-sm text-zinc-300 whitespace-pre-wrap">{series.bible}</p></Card>
    {seasons.map((s) => (
      <Card key={s.id} className="mb-4">
        <div className="flex items-center gap-3 mb-2"><h2 className="font-semibold">Season {s.number} – {s.title}</h2><Badge text={s.status} tone={statusTone(s.status)} /></div>
        <p className="text-sm text-zinc-400 mb-3">{s.arc}</p>
        <Table head={["#","Cím","Státusz","Célhossz","Költség (becsült/tényleges)"]}>
          {episodes.filter((e) => e.season_id === s.id).sort((a,b)=>a.number-b.number).map((e) => (
            <tr key={e.id}><td>{e.number}</td><td><Link className="text-amber-400 hover:underline" href={`/episodes/${e.id}`}>{e.title}</Link></td><td><Badge text={e.status} tone={statusTone(e.status)} /></td><td>{Math.round(e.target_duration_sec/60)} perc</td><td>${e.estimated_cost} / ${e.actual_cost.toFixed(2)}</td></tr>
          ))}
        </Table>
        <form action={createEpisodeAction} className="grid md:grid-cols-5 gap-3 mt-4">
          <input type="hidden" name="season_id" value={s.id} /><input type="hidden" name="series_id" value={series.id} />
          <div><label>Epizód szám</label><input name="number" type="number" required /></div>
          <div className="md:col-span-2"><label>Cím</label><input name="title" required /></div>
          <div><label>Célhossz (mp)</label><input name="target_duration_sec" type="number" defaultValue="1200" /></div>
          <div><label>&nbsp;</label><SubmitButton label="Create Episode" /></div>
          <div className="md:col-span-5"><label>Brief</label><textarea name="brief" rows={2} /></div>
        </form>
      </Card>
    ))}
    <Card><h2 className="font-semibold mb-3">Új évad</h2>
      <form action={createSeasonAction} className="grid md:grid-cols-4 gap-3">
        <input type="hidden" name="series_id" value={series.id} />
        <div><label>Szám</label><input name="number" type="number" required /></div>
        <div className="md:col-span-2"><label>Cím</label><input name="title" required /></div>
        <div><label>&nbsp;</label><SubmitButton label="Évad létrehozása" /></div>
        <div className="md:col-span-4"><label>Season arc</label><textarea name="arc" rows={2} /></div>
      </form>
    </Card>
  </>);
}
