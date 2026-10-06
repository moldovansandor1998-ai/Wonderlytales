import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone, Card, SubmitButton } from "@/components/ui";
import type { RenderJob, ShotRow } from "@/lib/types";
import { processQueueAction } from "@/lib/actions";
import Link from "next/link";

export default async function RenderQueuePage() {
  const db = await getDb();
  const jobs = (await db.list<RenderJob>("render_jobs")).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const shots = await db.list<ShotRow>("shots");
  const shotLabel = (id: string) => { const s = shots.find((x) => x.id === id); return s ? `SH${String(s.shot_number).padStart(3,"0")}` : id.slice(0,8); };
  return (<>
    <PageTitle title="Render Queue" sub="QUEUED → CLAIMED → RUNNING → SUCCEEDED/FAILED/RETRY_WAIT" />
    <Card className="mb-4"><form action={processQueueAction}><SubmitButton label="Következő job feldolgozása (mock worker)" /></form></Card>
    <Table head={["Shot","Típus","Státusz","Attempt","Worker/Provider","GPU mp","Költség","Output","Hiba"]}>
      {jobs.map((j) => (<tr key={j.id}>
        <td><Link href={`/shots/${j.shot_id}`} className="text-amber-400 hover:underline">{shotLabel(j.shot_id)}</Link></td>
        <td>{j.type}</td><td><Badge text={j.status} tone={statusTone(j.status)} /></td>
        <td>{j.attempt}/{j.max_attempts}</td><td className="text-xs">{j.worker}/{j.provider}</td>
        <td>{j.gpu_seconds.toFixed(0)}</td><td>${j.cost_usd.toFixed(3)}</td>
        <td className="font-mono text-xs">{j.output_path ?? "–"}</td>
        <td className="text-xs text-red-400">{j.error ?? ""}</td></tr>))}
      {jobs.length === 0 && <tr><td colSpan={9} className="text-center text-zinc-500 py-4">A queue üres – generálj preview-t egy shot oldalán.</td></tr>}
    </Table>
  </>);
}
