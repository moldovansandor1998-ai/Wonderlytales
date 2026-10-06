import { getDb } from "@/lib/db";
import { Card, PageTitle, Badge, statusTone } from "@/components/ui";
import { aggregateCosts } from "@/lib/cost";
import type { CostEvent, RenderJob, Episode, ShotRow, Series, Season } from "@/lib/types";
import Link from "next/link";

export default async function Dashboard() {
  const db = await getDb();
  const [series, episodes, jobs, costs, shots] = await Promise.all([
    db.list<Series>("series"), db.list<Episode>("episodes"), db.list<RenderJob>("render_jobs"), db.list<CostEvent>("cost_events"), db.list<ShotRow>("shots"),
  ]);
  const seasons = await db.list<Season>("seasons");
  const cost = aggregateCosts(costs);
  const active = jobs.filter((j) => ["QUEUED","RUNNING","RETRY_WAIT"].includes(j.status));
  const failed = jobs.filter((j) => j.status === "FAILED");
  return (<>
    <PageTitle title="Production Dashboard" sub={`Mód: ${db.mode() === "mock" ? "MOCK (lokális JSON adatbázis)" : "Supabase"}`} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card><div className="text-3xl font-bold">{episodes.length}</div><div className="text-sm text-zinc-400">Aktív epizód</div></Card>
      <Card><div className="text-3xl font-bold text-sky-400">{active.length}</div><div className="text-sm text-zinc-400">Queue-ban</div></Card>
      <Card><div className="text-3xl font-bold text-red-400">{failed.length}</div><div className="text-sm text-zinc-400">Sikertelen job</div></Card>
      <Card><div className="text-3xl font-bold text-amber-400">${cost.currentMonth.toFixed(2)}</div><div className="text-sm text-zinc-400">Havi költség</div></Card>
    </div>
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <h2 className="font-semibold mb-3">Produkciók</h2>
        {series.map((sr) => (
          <div key={sr.id} className="mb-3">
            <Link href={`/series/${sr.id}`} className="text-amber-400 font-medium hover:underline">{sr.name} / {sr.international_name}</Link>
            <div className="text-xs text-zinc-500">{seasons.filter((s) => s.series_id === sr.id).length} évad · {sr.age_range} év · {sr.fps} fps</div>
            {episodes.filter((e) => seasons.some((s) => s.id === e.season_id && s.series_id === sr.id)).map((e) => (
              <div key={e.id} className="ml-3 mt-1 flex items-center gap-2 text-sm">
                <Link href={`/episodes/${e.id}`} className="hover:underline">E{String(e.number).padStart(2,"0")} – {e.title}</Link>
                <Badge text={e.status} tone={statusTone(e.status)} />
              </div>
            ))}
          </div>
        ))}
      </Card>
      <Card>
        <h2 className="font-semibold mb-3">Shot státuszok</h2>
        <div className="space-y-1 text-sm">
          {shots.map((s) => (<div key={s.id} className="flex justify-between"><Link href={`/shots/${s.id}`} className="hover:underline">Shot #{s.shot_number} (r{s.revision})</Link><Badge text={s.status} tone={statusTone(s.status)} /></div>))}
          {shots.length === 0 && <div className="text-zinc-500">Nincs shot.</div>}
        </div>
      </Card>
    </div>
  </>);
}
