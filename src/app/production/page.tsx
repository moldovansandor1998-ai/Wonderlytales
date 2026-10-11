import { createServerSupabase, requireStudioUser } from "@/lib/auth";
import { PageTitle, Card, Table, Badge } from "@/components/ui";
import { filmProgress, type FilmRun, type FilmTask, type FilmControl } from "@/lib/filmProduction";
import { controlFilm } from "./actions";
import Refresh from "./Refresh";
import Link from "next/link";
export const dynamic="force-dynamic";
export default async function Production() {
 await requireStudioUser();
 const db=createServerSupabase();
 const [runs,tasks,control]=await Promise.all([
  db.from("film_runs").select("*").order("created_at",{ascending:false}).limit(30),
  db.from("film_tasks").select("id,run_id,ordinal,scene_id,kind,status,frames,attempts,max_attempts,external_job_id,output_key,error").order("ordinal").limit(20000),
  db.from("film_control_status").select("*").single()
 ]);
 const failure=runs.error || tasks.error || control.error;
 if(failure) return <Card><p>A gyártási állapot nem olvasható: {failure.message}</p></Card>;
 const c=control.data as FilmControl;
 const heartbeat=c.scheduler_heartbeat?new Date(c.scheduler_heartbeat):null;
 const live=heartbeat && Date.now()-heartbeat.getTime()<180000;
 return <>
  <PageTitle title="Filmgyártás" sub="Minimum 40, alapértelmezetten 60 perces epizódok. A render elkészülte után külön minőségi ellenőrzés szükséges." />
  <Card className="mb-5"><h2 className="text-lg font-semibold">Aktív sorozat: Titokváros</h2><p className="my-2">Új állatváros, nyolc saját főszereplő és natív 3D animáció. Először a 48 másodperces bemutatójelenet készül. A Csodakapu korábbi próbái archív anyagok.</p><Link className="text-amber-400" href="/titokvaros">Titokváros megnyitása — karakterek, évad és hangpróbák</Link></Card>
  <Card className="mb-5">
   <div className="flex gap-3 flex-wrap"><Badge text={live?"Vezérlő működik":"Vezérlő nem igazolt"} tone={live?"green":"red"}/><Badge text={c.dispatch_enabled && c.endpoint_verified?"Natív render engedélyezve":"Natív render indítása blokkolva"} tone="amber"/><Refresh/></div>
   <p className="mt-3 text-sm">Utolsó automatikus jelzés: {heartbeat?heartbeat.toLocaleString("hu-HU",{timeZone:"Asia/Saigon"}):"nincs"}. Folyamatban lévő külső munkák: {c.active_remote}.</p>
   {c.error && <p className="mt-2 text-amber-300">{c.error}</p>}
   <p className="mt-2 text-xs text-zinc-400">Az adatbázis vezérlője zárt böngésző és megszakadt Work mellett is fut. Blender a külön natív háttérfeldolgozón renderel; a vezérlő önmagában nem készít videót.</p>
  </Card>
  {(runs.data as FilmRun[]).map(r => { const p=filmProgress(r,tasks.data as FilmTask[]); return <Card key={r.id} className="mb-5">
   <div className="flex gap-3 items-center flex-wrap"><h2 className="font-semibold text-lg">{r.title}</h2><Badge text={r.mode==="DIAGNOSTIC"?"Minőségvizsgálati próba":"Epizód"}/><Badge text={r.status}/><Badge text={p.approved?"Minőségileg elfogadott":"Minőségileg nincs elfogadva"} tone={p.approved?"green":"amber"}/></div>
   <p className="my-3">Hossz: {(p.seconds/60).toFixed(2)} perc · {r.scene_count} jelenet · {p.done}/{p.tasks} renderfeladat · {p.errors} hibás vagy blokkolt feladat</p>
   <progress value={p.percent} max={100} className="w-full h-3 accent-amber-400"/><p className="text-sm mt-1">{p.percent}% render kész. Ez nem a film minőségi készültsége.</p>
   <div className="flex gap-4 my-3">{r.output_key && <Link className="text-amber-400" href={`/api/production/video?run=${r.id}`} target="_blank">Elkészült videó megnyitása</Link>}
   {r.status==="ACTIVE" && <form action={controlFilm.bind(null,r.id,"PAUSE")}><button className="text-amber-400">Új feladatok szüneteltetése</button></form>}
   {["HELD","PAUSED"].includes(r.status) && c.dispatch_enabled && c.endpoint_verified && (r.mode==="DIAGNOSTIC" || r.quality_report.production_approved===true) && <form action={controlFilm.bind(null,r.id,"RESUME")}><button className="text-amber-400">Folytatás</button></form>}</div>
   {r.error && <p className="text-red-400 my-2">{r.error}</p>}
   <details className="my-3"><summary className="cursor-pointer text-amber-400">Minőségi jelentés</summary><pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(r.quality_report,null,2)}</pre></details>
   <Table head={["Feladat","Jelenet","Állapot","Próbálkozás","Külső azonosító","Hiba"]}>
   {(tasks.data as FilmTask[]).filter(t=>t.run_id===r.id).map(t=><tr key={t.id}><td>{t.ordinal}</td><td>{t.scene_id}</td><td>{t.status}</td><td>{t.attempts}/{t.max_attempts}</td><td className="text-xs break-all">{t.external_job_id??"–"}</td><td className="text-xs text-red-300">{t.error}</td></tr>)}
   </Table>
  </Card>; })}
  {runs.data.length===0 && <Card>Még nincs mentett gyártási futás.</Card>}
 </>;
}
