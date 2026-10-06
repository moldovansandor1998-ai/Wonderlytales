import { getDb } from "@/lib/db";
import { PageTitle, Table, Badge, Card, SubmitButton } from "@/components/ui";
import type { Voice, Character } from "@/lib/types";
import { createVoiceAction, updateVoiceAction, testVoiceAction } from "@/lib/actions";
import { VoiceTestButton } from "@/components/forms";

export default async function VoicesPage() {
  const db = await getDb();
  const [voices, chars] = await Promise.all([db.list<Voice>("voices"), db.list<Character>("characters")]);
  const nameOf = (id: string) => chars.find((c) => c.id === id)?.name ?? id;
  return (<>
    <PageTitle title="Voices" sub="Karakter × nyelv voice konfigurációk (ElevenLabs / mock)" />
    <Table head={["Karakter","Nyelv","Provider","Voice ID","Model","Stability/Style","Műveletek"]}>
      {voices.map((v) => (<tr key={v.id}>
        <td>{nameOf(v.character_id)}</td><td><Badge text={v.language.toUpperCase()} tone="blue" /></td>
        <td>{v.provider}</td><td className="font-mono text-xs">{v.voice_id}</td><td>{v.model}</td>
        <td>{v.stability} / {v.style}</td>
        <td className="whitespace-nowrap">
          <details className="inline-block mr-2"><summary className="cursor-pointer text-xs text-zinc-400 hover:text-white">szerkesztés</summary>
            <form action={updateVoiceAction.bind(null, v.id)} className="grid grid-cols-2 gap-2 mt-2 p-2 border border-zinc-800 rounded">
              <div><label>Nyelv</label><input name="language" defaultValue={v.language} /></div>
              <div><label>Provider</label><select name="provider" defaultValue={v.provider}><option>mock</option><option>elevenlabs</option></select></div>
              <div><label>Voice ID</label><input name="voice_id" defaultValue={v.voice_id} /></div>
              <div><label>Model</label><input name="model" defaultValue={v.model} /></div>
              <div><label>Stability</label><input name="stability" type="number" step="0.05" defaultValue={v.stability} /></div>
              <div><label>Style</label><input name="style" type="number" step="0.05" defaultValue={v.style} /></div>
              <div className="col-span-2"><SubmitButton label="Mentés" /></div>
            </form></details>
          <VoiceTestButton action={testVoiceAction.bind(null, v.id)} />
        </td></tr>))}
    </Table>
    <Card className="mt-6"><h2 className="font-semibold mb-3">Új voice config</h2>
      <form action={createVoiceAction} className="grid md:grid-cols-3 gap-3">
        <div><label>Karakter</label><select name="character_id">{chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>Nyelv</label><input name="language" defaultValue="en" /></div>
        <div><label>Provider</label><select name="provider"><option>mock</option><option>elevenlabs</option></select></div>
        <div><label>Voice ID</label><input name="voice_id" required /></div>
        <div><label>Model</label><input name="model" defaultValue="eleven_multilingual_v2" /></div>
        <div><label>Stability</label><input name="stability" type="number" step="0.05" defaultValue="0.5" /></div>
        <div><SubmitButton label="Létrehozás" /></div>
      </form></Card>
  </>);
}
