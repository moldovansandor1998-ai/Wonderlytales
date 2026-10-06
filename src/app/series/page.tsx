import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone, Card, SubmitButton } from "@/components/ui";
import type { Series, Project } from "@/lib/types";
import { createSeriesAction } from "@/lib/actions";
import Link from "next/link";

export default async function SeriesPage() {
  const db = await getDb();
  const [series, projects] = await Promise.all([db.list<Series>("series"), db.list<Project>("projects")]);
  return (<>
    <PageTitle title="Series" sub="Sorozatok a stúdióban" />
    <Table head={["Név","International","Korosztály","FPS","Felbontás","Státusz"]}>
      {series.map((s) => (<tr key={s.id} className="hover:bg-zinc-900"><td><Link className="text-amber-400 hover:underline" href={`/series/${s.id}`}>{s.name}</Link></td><td>{s.international_name}</td><td>{s.age_range}</td><td>{s.fps}</td><td>{s.resolution}</td><td><Badge text={s.status} tone={statusTone(s.status)} /></td></tr>))}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új sorozat</h2>
      <form action={createSeriesAction} className="grid md:grid-cols-3 gap-3">
        <div><label>Név</label><input name="name" required /></div>
        <div><label>International név</label><input name="international_name" /></div>
        <div><label>Korosztály</label><input name="age_range" defaultValue="4-9" /></div>
        <div><label>FPS</label><input name="fps" type="number" defaultValue="24" /></div>
        <div><label>Felbontás</label><input name="resolution" defaultValue="1920x1080" /></div>
        <div><label>Vizuális stílus</label><input name="visual_style" /></div>
        <div className="md:col-span-3"><label>Bible</label><textarea name="bible" rows={3} /></div>
        <input type="hidden" name="project_id" value={projects[0]?.id ?? ""} />
        <div><SubmitButton label="Létrehozás" /></div>
      </form>
    </Card>
  </>);
}
