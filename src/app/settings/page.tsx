import { getDb } from "@/lib/db";
import { PageTitle, Card, Badge } from "@/components/ui";

export default async function SettingsPage() {
  const db = await getDb();
  const row = (k: string, set: boolean) => (<div className="flex justify-between py-1.5 border-b border-zinc-800 text-sm"><span className="font-mono">{k}</span><Badge text={set ? "BEÁLLÍTVA" : "HIÁNYZIK"} tone={set ? "green" : "amber"} /></div>);
  return (<>
    <PageTitle title="Settings" sub="Éles gyártási szolgáltatások állapota – hiányzó beállítás esetén a művelet leáll" />
    <div className="grid lg:grid-cols-2 gap-6">
      <Card><h2 className="font-semibold mb-3">Adatbázis</h2>
        <div className="flex justify-between py-1.5 border-b border-zinc-800 text-sm"><span>Aktív mód</span><Badge text={db.mode().toUpperCase()} tone={db.mode() === "supabase" ? "green" : "amber"} /></div>
        {row("NEXT_PUBLIC_SUPABASE_URL", !!process.env.NEXT_PUBLIC_SUPABASE_URL)}
        {row("SUPABASE publishable/Auth", !!(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))}
      </Card>
      <Card><h2 className="font-semibold mb-3">Providerek</h2>
        {row("HF_TOKEN (3D modellkészítés)", !!process.env.HF_TOKEN)}
        <a className="text-sm text-cyan-400 underline" href="/api/authoring/hf-access" target="_blank" rel="noreferrer">Hugging Face modellhozzáférés ellenőrzése</a>
        {row("ELEVENLABS_API_KEY (TTS)", !!process.env.ELEVENLABS_API_KEY)}
        {row("AUDIO2FACE_ENDPOINT (facial)", !!process.env.AUDIO2FACE_ENDPOINT)}
        {row("GENVIDEO_API_KEY", !!process.env.GENVIDEO_API_KEY)}
        {row("S3/R2 endpoint", !!process.env.S3_ENDPOINT)}
        {row("S3/R2 credentials", !!(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY))}
        {row("RunPod worker", !!(process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID))}
        {row("STORY_API_KEY (story)", !!process.env.STORY_API_KEY)}
      </Card>
    </div>
  </>);
}
