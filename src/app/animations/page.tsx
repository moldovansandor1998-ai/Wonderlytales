import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, Card, SubmitButton } from "@/components/ui";
import type { Animation } from "@/lib/types";
import { createAnimationAction, updateAnimationAction } from "@/lib/actions";

export default async function AnimationsPage({ searchParams }: { searchParams: { q?: string; cat?: string } }) {
  const db = await getDb();
  const q = (searchParams.q ?? "").toLowerCase();
  const cat = searchParams.cat ?? "";
  const anims = (await db.list<Animation>("animations"))
    .filter((a) => !q || a.name.toLowerCase().includes(q) || a.code.includes(q))
    .filter((a) => !cat || a.category === cat);
  const cats = [...new Set((await db.list<Animation>("animations")).map((a) => a.category))];
  return (<>
    <PageTitle title="Animation Library" sub="Reusable motion-ök (cél: 100–500)" />
    <form className="mb-4 flex gap-2 flex-wrap">
      <input name="q" placeholder="Keresés…" defaultValue={searchParams.q} className="max-w-xs" />
      <select name="cat" defaultValue={cat} className="max-w-[180px]"><option value="">Minden kategória</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <SubmitButton label="Szűrés" />
    </form>
    <Table head={["Kód","Név","Kategória","Időtartam","Loop","Kompatibilitás","Műveletek"]}>
      {anims.map((a) => (<tr key={a.id}>
        <td className="font-mono text-xs">{a.code}</td><td>{a.name}</td><td><Badge text={a.category} tone="blue" /></td>
        <td>{a.duration_sec}s</td><td>{a.loopable ? "✓" : "–"}</td>
        <td className="text-xs text-zinc-400">{a.compatibility.join(", ")}</td>
        <td><details><summary className="cursor-pointer text-xs text-zinc-400 hover:text-white">szerkesztés</summary>
          <form action={updateAnimationAction.bind(null, a.id)} className="grid grid-cols-2 gap-2 mt-2 p-2 border border-zinc-800 rounded">
            <div><label>Név</label><input name="name" defaultValue={a.name} /></div>
            <div><label>Kategória</label><input name="category" defaultValue={a.category} /></div>
            <div><label>Skeleton</label><input name="skeleton_profile" defaultValue={a.skeleton_profile} /></div>
            <div><label>Időtartam</label><input name="duration_sec" type="number" step="0.1" defaultValue={a.duration_sec} /></div>
            <div><label><input type="checkbox" name="loopable" className="w-auto mr-1" defaultChecked={a.loopable} />Loop</label></div>
            <div><label>Tagek</label><input name="tags" defaultValue={a.tags.join(",")} /></div>
            <div className="col-span-2"><label>Kompatibilitás</label><input name="compatibility" defaultValue={a.compatibility.join(",")} /></div>
            <div className="col-span-2"><SubmitButton label="Mentés" /></div>
          </form></details></td></tr>))}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új animáció</h2>
      <form action={createAnimationAction} className="grid md:grid-cols-3 gap-3">
        <div><label>Kód</label><input name="code" required /></div>
        <div><label>Név</label><input name="name" required /></div>
        <div><label>Kategória</label><input name="category" defaultValue="idle" /></div>
        <div><label>Skeleton profil</label><input name="skeleton_profile" defaultValue="STANDARD_BIPED_V1" /></div>
        <div><label>Időtartam (mp)</label><input name="duration_sec" type="number" step="0.1" defaultValue="1.5" /></div>
        <div><label><input type="checkbox" name="loopable" className="w-auto mr-2" />Loopolható</label></div>
        <div><label>Tagek (vesszővel)</label><input name="tags" /></div>
        <div className="md:col-span-2"><label>Kompatibilitás (CHAR_ kódok)</label><input name="compatibility" /></div>
        <div><SubmitButton label="Létrehozás" /></div>
      </form></Card>
  </>);
}
