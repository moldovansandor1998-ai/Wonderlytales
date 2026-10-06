import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge, statusTone, Table } from "@/components/ui";
import type { Episode, EpisodeLocalization, DialogueLine, LocalizedLine } from "@/lib/types";
import { localizeAction } from "@/lib/actions";

export default async function LocalizationPage() {
  const db = await getDb();
  const [eps, locs, lines, locLines] = await Promise.all([db.list<Episode>("episodes"), db.list<EpisodeLocalization>("episode_localizations"), db.list<DialogueLine>("dialogue_lines"), db.list<LocalizedLine>("localized_dialogue_lines")]);
  return (<>
    <PageTitle title="Localization" sub="HU master → fordítás → célnyelvi TTS → új lip-sync track (a 3D animáció nem renderelődik újra)" />
    {eps.map((ep) => (
      <Card key={ep.id} className="mb-6">
        <h2 className="font-semibold mb-3">E{String(ep.number).padStart(2,"0")} – {ep.title}</h2>
        <div className="flex gap-2 flex-wrap mb-4">
          {locs.filter((l) => l.episode_id === ep.id).sort((a,b)=>a.language.localeCompare(b.language)).map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <Badge text={`${l.language.toUpperCase()} ${l.status}`} tone={statusTone(l.status)} />
              {l.status !== "READY" && l.language !== ep.master_language && (
                <form action={localizeAction.bind(null, ep.id, l.language)}><button className="text-xs text-amber-400 hover:underline">Lokalizálás indítása</button></form>)}
            </div>))}
        </div>
        <Table head={["#","HU master","Lokalizált változatok"]}>
          {lines.map((l) => (<tr key={l.id}>
            <td>{l.sequence}</td><td className="text-sm">{l.text}</td>
            <td className="text-xs">{locLines.filter((x) => x.dialogue_line_id === l.id).map((x) => <div key={x.id}><Badge text={`${x.language.toUpperCase()} ${x.status}`} tone={statusTone(x.status)} /> <span className="text-zinc-400">{x.text}</span></div>)}</td>
          </tr>))}
        </Table>
      </Card>))}
  </>);
}
