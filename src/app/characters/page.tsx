import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone, Card, SubmitButton } from "@/components/ui";
import type { Character, CharacterVersion } from "@/lib/types";
import { createCharacterAction } from "@/lib/actions";
import Link from "next/link";

export default async function CharactersPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = await getDb();
  const q = (searchParams.q ?? "").toLowerCase();
  const chars = (await db.list<Character>("characters")).filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  const versions = await db.list<CharacterVersion>("character_versions");
  return (<>
    <PageTitle title="Character Library" sub="CORE / RECURRING / GUEST karakterek, verziózott 3D master assetekkel" />
    <Link className="text-amber-400 block mb-4" href="/characters/native-models">Csodakapu natív 3D-modellek ellenőrzése</Link>
    <form className="mb-4"><input name="q" placeholder="Keresés…" defaultValue={searchParams.q} className="max-w-xs" /></form>
    <Table head={["Kód","Név","Típus","Faj","Verziók","Státusz"]}>
      {chars.map((c) => (<tr key={c.id} className="hover:bg-zinc-900">
        <td className="font-mono text-xs">{c.code}</td>
        <td><Link className="text-amber-400 hover:underline" href={`/characters/${c.id}`}>{c.name}</Link></td>
        <td><Badge text={c.type} tone={c.type === "CORE" ? "purple" : c.type === "RECURRING" ? "blue" : "zinc"} /></td>
        <td>{c.species}</td>
        <td>{versions.filter((v) => v.character_id === c.id).map((v) => <Badge key={v.id} text={`${v.version}${v.status === "LOCKED" ? " 🔒" : ""}`} tone={statusTone(v.status)} />)}</td>
        <td><Badge text={c.status} tone={statusTone(c.status)} /></td></tr>))}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új karakter</h2>
      <form action={createCharacterAction} className="grid md:grid-cols-3 gap-3">
        <div><label>Kód (CHAR_*)</label><input name="code" required placeholder="CHAR_UJ" /></div>
        <div><label>Név</label><input name="name" required /></div>
        <div><label>Típus</label><select name="type"><option>CORE</option><option>RECURRING</option><option>GUEST</option></select></div>
        <div><label>Faj / típus</label><input name="species" /></div>
        <div><label>Nem (opcionális)</label><input name="gender" /></div>
        <div><label>Kor leírás</label><input name="age_description" defaultValue="gyerek" /></div>
        <div><label>Személyiség</label><input name="personality" /></div>
        <div><label>Vizuális leírás</label><input name="visual_description" /></div>
        <div><label>Beszédstílus</label><input name="speech_style" /></div>
        <div><SubmitButton label="Létrehozás" /></div>
      </form>
    </Card>
  </>);
}
