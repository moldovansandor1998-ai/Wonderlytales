import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge, statusTone, SubmitButton, Table } from "@/components/ui";
import type { Character, CharacterVersion, Voice } from "@/lib/types";
import { updateCharacterAction, newCharacterVersionAction, lockVersionAction, addCostumeAction } from "@/lib/actions";
import { notFound } from "next/navigation";

export default async function CharacterDetail({ params }: { params: { id: string } }) {
  const db = await getDb();
  const c = await db.get<Character>("characters", params.id);
  if (!c) notFound();
  const versions = (await db.find<CharacterVersion>("character_versions", (v) => v.character_id === c.id)).sort((a,b) => b.version.localeCompare(a.version));
  const voices = await db.find<Voice>("voices", (v) => v.character_id === c.id);
  const upd = updateCharacterAction.bind(null, c.id);
  const newV = newCharacterVersionAction.bind(null, c.id);
  return (<>
    <PageTitle title={`${c.name} (${c.code})`} sub={`${c.type} · ${c.species}`} />
    <div className="grid lg:grid-cols-2 gap-6">
      <Card><h2 className="font-semibold mb-3">Adatok</h2>
        <form action={upd} className="space-y-3">
          <div><label>Név</label><input name="name" defaultValue={c.name} /></div>
          <div><label>Személyiség</label><textarea name="personality" defaultValue={c.personality} rows={2} /></div>
          <div><label>Vizuális leírás</label><textarea name="visual_description" defaultValue={c.visual_description} rows={2} /></div>
          <div><label>Beszédstílus</label><input name="speech_style" defaultValue={c.speech_style} /></div>
          <div><label>Státusz</label><select name="status" defaultValue={c.status}><option>ACTIVE</option><option>RETIRED</option></select></div>
          <SubmitButton label="Mentés" />
        </form>
        <div className="mt-4"><h3 className="text-sm font-semibold mb-2">Voice konfigurációk</h3>
          {voices.map((v) => <div key={v.id} className="text-sm flex gap-2"><Badge text={v.language.toUpperCase()} tone="blue" /><span className="font-mono text-xs">{v.provider}/{v.voice_id}</span></div>)}
        </div>
      </Card>
      <Card><div className="flex justify-between items-center mb-3"><h2 className="font-semibold">Verziók</h2>
        <form action={newV}><SubmitButton label="+ Új verzió" /></form></div>
        <Table head={["Verzió","Asset ID","Rig","Facial","Státusz",""]}>
          {versions.map((v) => (<tr key={v.id}>
            <td className="font-mono">{v.version}</td><td className="font-mono text-xs">{v.asset_id}</td>
            <td className="text-xs">{v.rig_profile}</td><td className="text-xs">{v.facial_profile}</td>
            <td><Badge text={v.status} tone={statusTone(v.status)} /></td>
            <td>{v.status === "DRAFT" && (<form action={lockVersionAction.bind(null, "character_versions", v.id, `/characters/${c.id}`)}><button className="text-xs text-amber-400 hover:underline">Lock</button></form>)}</td>
          </tr>))}
        </Table>
        {versions[0] && (<div className="mt-4 text-sm text-zinc-400">
          <div>Scale: {versions[0].scale} · Costumes: {versions[0].costumes.join(", ")}</div>
          {versions[0].status === "DRAFT" && (<form action={addCostumeAction.bind(null, c.id)} className="flex gap-2 mt-2 items-end">
            <div><label>Új costume</label><input name="costume" placeholder="pl. winter" /></div>
            <SubmitButton label="Hozzáadás" /></form>)}
          <div>Expressions: {versions[0].expressions.join(", ")}</div>
          <div>Retarget: {versions[0].retarget_profile} · Viseme: {versions[0].viseme_profile}</div>
        </div>)}
      </Card>
    </div>
  </>);
}
