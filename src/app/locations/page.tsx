import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone, Card, SubmitButton } from "@/components/ui";
import type { Location, LocationVersion } from "@/lib/types";
import { createLocationAction, lockVersionAction, updateLocationAction } from "@/lib/actions";

export default async function LocationsPage() {
  const db = await getDb();
  const [locs, versions] = await Promise.all([db.list<Location>("locations"), db.list<LocationVersion>("location_versions")]);
  return (<>
    <PageTitle title="Locations" sub="Fix, verziózott helyszín-assetek (DAY/NIGHT/RAIN/WINTER variánsok)" />
    <Table head={["Kód","Név","Variánsok","Verzió","Státusz",""]}>
      {locs.map((l) => { const v = versions.filter((x) => x.location_id === l.id)[0]; return (<tr key={l.id}>
        <td className="font-mono text-xs">{l.code}</td><td>{l.name}<div className="text-xs text-zinc-500">{l.description}</div></td>
        <td>{l.variants.map((x) => <Badge key={x} text={x} />)}</td>
        <td className="font-mono text-xs">{v?.asset_id}</td>
        <td>{v && <Badge text={`${v.version} ${v.status}`} tone={statusTone(v.status)} />}</td>
        <td className="whitespace-nowrap">{v?.status === "DRAFT" && <form action={lockVersionAction.bind(null,"location_versions",v.id,"/locations")} className="inline"><button className="text-xs text-amber-400 hover:underline">Lock</button></form>}
          <details className="inline-block ml-2"><summary className="cursor-pointer text-xs text-zinc-400 hover:text-white">szerkesztés</summary>
            <form action={updateLocationAction.bind(null, l.id)} className="grid grid-cols-2 gap-2 mt-2 p-2 border border-zinc-800 rounded">
              <div><label>Név</label><input name="name" defaultValue={l.name} /></div>
              <div><label>Státusz</label><select name="status" defaultValue={l.status}><option>ACTIVE</option><option>ARCHIVED</option></select></div>
              <div className="col-span-2"><label>Leírás</label><input name="description" defaultValue={l.description} /></div>
              <div><label>Variánsok</label><input name="variants" defaultValue={l.variants.join(",")} /></div>
              <div className="flex items-end"><SubmitButton label="Mentés" /></div>
            </form></details></td>
      </tr>); })}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új helyszín</h2>
      <form action={createLocationAction} className="grid md:grid-cols-2 gap-3">
        <div><label>Kód (LOC_*)</label><input name="code" required /></div>
        <div><label>Név</label><input name="name" required /></div>
        <div className="md:col-span-2"><label>Leírás</label><input name="description" /></div>
        <div><label>Variánsok (vesszővel)</label><input name="variants" defaultValue="DAY,NIGHT" /></div>
        <div><label>&nbsp;</label><SubmitButton label="Létrehozás" /></div>
      </form></Card>
  </>);
}
