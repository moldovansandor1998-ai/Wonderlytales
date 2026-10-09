import { requireStudioUser } from '@/lib/auth';
import { performanceItems, performanceBatch } from '@/lib/performanceAudio';
import { getStorage } from '@/lib/providers/storage';
import { MasterAudioButton } from '@/components/masterAudioButton';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
async function generate(id: string) { 'use server'; await requireStudioUser(); return performanceBatch(id); }
export default async function PerformancePage({ params }: { params: { id: string } }) {
  await requireStudioUser();
  const items = await performanceItems(params.id), storage = getStorage();
  const ready = await Promise.all(items.map(i => storage.exists(i.path)));
  return <><h1 className="text-2xl mb-4">A csillagszilánk – érzelmek és reakciók</h1>
    <p className="mb-4">{ready.filter(Boolean).length}/{items.length} hang. A megszokott öt karakterhang, rendezett előadás és külön reakciók. Meghallgatásra váró felvételek.</p>
    <MasterAudioButton action={generate.bind(null, params.id)} />
    {ready.every(Boolean) && <a className="text-amber-400 block my-4" href={`/api/episodes/${params.id}/performance`}>Rendezett hangok és reakciók letöltése ZIP-ben</a>}
    {items.map((i, n) => <div className="my-3" key={i.id}><p>{i.character}: {i.text}</p><p className="text-xs text-zinc-400">{i.performance_text}</p>{ready[n] && <audio controls preload="none" src={`/api/episodes/${params.id}/performance?clip=${i.id}`} />}</div>)}
  </>;
}
