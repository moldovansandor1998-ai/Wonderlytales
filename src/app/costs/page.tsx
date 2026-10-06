import { getDb } from "@/lib/db";
import { PageTitle, Card, Table } from "@/components/ui";
import { aggregateCosts, costPerMinute } from "@/lib/cost";
import type { CostEvent, Episode } from "@/lib/types";

export default async function CostsPage() {
  const db = await getDb();
  const [events, episodes] = await Promise.all([db.list<CostEvent>("cost_events"), db.list<Episode>("episodes")]);
  const s = aggregateCosts(events);
  return (<>
    <PageTitle title="Cost Center" sub="GPU, TTS, Storage, Generative Video, Translation, LLM, Retry" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card><div className="text-2xl font-bold">${s.currentMonth.toFixed(2)}</div><div className="text-sm text-zinc-400">Aktuális hónap</div></Card>
      <Card><div className="text-2xl font-bold">${s.total.toFixed(2)}</div><div className="text-sm text-zinc-400">Összes</div></Card>
      <Card><div className="text-2xl font-bold text-red-400">${s.retryCost.toFixed(2)}</div><div className="text-sm text-zinc-400">Retry költség</div></Card>
      <Card><div className="text-2xl font-bold">{Object.keys(s.byProvider).length}</div><div className="text-sm text-zinc-400">Provider</div></Card>
    </div>
    <div className="grid lg:grid-cols-2 gap-6 mb-6">
      <Card><h2 className="font-semibold mb-3">Kategória bontás</h2>
        {Object.entries(s.byCategory).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1 border-b border-zinc-800"><span>{k}</span><span>${v.toFixed(3)}</span></div>)}
        {Object.keys(s.byCategory).length === 0 && <p className="text-sm text-zinc-500">Nincs költség-esemény.</p>}
      </Card>
      <Card><h2 className="font-semibold mb-3">Provider bontás</h2>
        {Object.entries(s.byProvider).map(([k, v]) => <div key={k} className="flex justify-between text-sm py-1 border-b border-zinc-800"><span>{k}</span><span>${v.toFixed(3)}</span></div>)}
      </Card>
    </div>
    <Card className="mb-6"><h2 className="font-semibold mb-3">Epizódonként</h2>
      <Table head={["Epizód","Költség","Cost/minute"]}>
        {episodes.map((e) => { const c = s.byEpisode[e.id] ?? 0; return <tr key={e.id}><td>E{String(e.number).padStart(2,"0")} – {e.title}</td><td>${c.toFixed(3)}</td><td>${costPerMinute(c, e.target_duration_sec).toFixed(3)}/perc</td></tr>; })}
      </Table></Card>
    <Table head={["Időpont","Kategória","Provider","Összeg","Mennyiség"]}>
      {events.slice(-30).reverse().map((e) => (<tr key={e.id}><td className="text-xs text-zinc-500">{new Date(e.created_at).toLocaleString("hu")}</td><td>{e.category}</td><td>{e.provider}</td><td>${e.amount_usd.toFixed(3)}</td><td>{e.quantity} {e.unit}</td></tr>))}
    </Table>
  </>);
}
