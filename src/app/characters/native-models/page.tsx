import { requireStudioUser, createServerSupabase } from "@/lib/auth";
export const dynamic = "force-dynamic";
const codes = ["CHAR_MARK", "CHAR_LILI", "CHAR_MORZSI", "CHAR_POTTY", "CHAR_BOGYO", "CHAR_ZIZI"];
export default async function NativeModelReview() {
  await requireStudioUser();
  const db = createServerSupabase();
  const { data: characters } = await db.from("characters").select("id,code,name").in("code", codes);
  const { data: versions } = await db.from("character_versions").select("character_id,version,status,model_asset_id").in("version", ["V005", "V006"]).eq("status", "DRAFT");
  return <><h1 className="text-2xl font-semibold mb-3">Csodakapu – natív 3D-modell ellenőrzés</h1>
    <p className="mb-5">Ezek textúrázott modellezési draftok. A végleges test- és arcrig, szemvezérlés, mozgás és látvány ellenőrzése még hátravan.</p>
    {codes.map(code => {
      const character = characters?.find(c => c.code === code);
      const expected = ["CHAR_MARK", "CHAR_LILI"].includes(code) ? "V005" : "V006";
      const version = versions?.find(v => v.character_id === character?.id && v.version === expected);
      return <section key={code} className="border border-zinc-800 rounded-lg p-4 my-3">
        <h2 className="font-semibold">{character?.name ?? code}</h2>
        {version?.model_asset_id ? <a className="text-amber-400" href={`/api/authoring/draft/${code}`}>Textúrázott 3D-draft letöltése ({expected}, GLB)</a> : <p>Natív 3D-draft még nincs rögzítve.</p>}
      </section>;
    })}</>;
}
