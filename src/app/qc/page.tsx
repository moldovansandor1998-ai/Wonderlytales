import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone } from "@/components/ui";
import type { QcResult, ShotRow } from "@/lib/types";
import Link from "next/link";

export default async function QcPage() {
  const db = await getDb();
  const results = (await db.list<QcResult>("qc_results")).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const shots = await db.list<ShotRow>("shots");
  const shotLabel = (id: string) => { const s = shots.find((x) => x.id === id); return s ? `SH${String(s.shot_number).padStart(3,"0")}` : id.slice(0,8); };
  const counts = { PASS: 0, WARNING: 0, FAIL: 0, PENDING: 0 };
  results.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
  return (<>
    <PageTitle title="QC Dashboard" sub={`PASS: ${counts.PASS} · WARNING: ${counts.WARNING} · FAIL: ${counts.FAIL}`} />
    <Table head={["Shot","Check","Státusz","Score","Részletek","Időpont"]}>
      {results.map((r) => (<tr key={r.id}>
        <td><Link href={`/shots/${r.shot_id}`} className="text-amber-400 hover:underline">{shotLabel(r.shot_id)}</Link></td>
        <td className="text-xs">{r.check_name}</td><td><Badge text={r.status} tone={statusTone(r.status)} /></td>
        <td>{r.score}</td><td className="text-xs text-zinc-400">{r.details}</td>
        <td className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString("hu")}</td></tr>))}
      {results.length === 0 && <tr><td colSpan={6} className="text-center text-zinc-500 py-4">Még nincs QC eredmény.</td></tr>}
    </Table>
  </>);
}
