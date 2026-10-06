import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, statusTone, Card, SubmitButton } from "@/components/ui";
import type { Prop, PropVersion } from "@/lib/types";
import { createPropAction, lockVersionAction, updatePropAction } from "@/lib/actions";

export default async function PropsPage() {
  const db = await getDb();
  const [props, versions] = await Promise.all([db.list<Prop>("props"), db.list<PropVersion>("prop_versions")]);
  return (<>
    <PageTitle title="Props" sub="Kellékek allowed state-ekkel (pl. gate CLOSED/OPEN/ACTIVE)" />
    <Table head={["Kód","Név","Allowed states","Verzió",""]}>
      {props.map((p) => { const v = versions.filter((x) => x.prop_id === p.id)[0]; return (<tr key={p.id}>
        <td className="font-mono text-xs">{p.code}</td><td>{p.name}<div className="text-xs text-zinc-500">{p.description}</div></td>
        <td>{p.allowed_states.map((x) => <Badge key={x} text={x} />)}</td>
        <td>{v && <Badge text={`${v.version} ${v.status}`} tone={statusTone(v.status)} />}</td>
        <td className="whitespace-nowrap">{v?.status === "DRAFT" && <form action={lockVersionAction.bind(null,"prop_versions",v.id,"/props")} className="inline"><button className="text-xs text-amber-400 hover:underline">Lock</button></form>}
          <details className="inline-block ml-2"><summary className="cursor-pointer text-xs text-zinc-400 hover:text-white">szerkesztés</summary>
            <form action={updatePropAction.bind(null, p.id)} className="grid grid-cols-2 gap-2 mt-2 p-2 border border-zinc-800 rounded">
              <div><label>Név</label><input name="name" defaultValue={p.name} /></div>
              <div><label>Allowed states</label><input name="allowed_states" defaultValue={p.allowed_states.join(",")} /></div>
              <div className="col-span-2"><label>Leírás</label><input name="description" defaultValue={p.description} /></div>
              <div className="col-span-2"><SubmitButton label="Mentés" /></div>
            </form></details></td>
      </tr>); })}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új prop</h2>
      <form action={createPropAction} className="grid md:grid-cols-2 gap-3">
        <div><label>Kód (PROP_*)</label><input name="code" required /></div>
        <div><label>Név</label><input name="name" required /></div>
        <div className="md:col-span-2"><label>Leírás</label><input name="description" /></div>
        <div><label>Allowed states (vesszővel)</label><input name="allowed_states" defaultValue="DEFAULT" /></div>
        <div><label>&nbsp;</label><SubmitButton label="Létrehozás" /></div>
      </form></Card>
  </>);
}
