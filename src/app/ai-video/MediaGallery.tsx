'use client';
import {useEffect, useRef, useState} from 'react';
import type {GalleryItem, GalleryKind, GalleryPage} from '@/lib/ai-video/gallery-shared';

const tabs: {kind: GalleryKind; label: string}[] = [
  {kind: 'images', label: 'Képek'}, {kind: 'videos', label: 'Eredeti videók'}, {kind: 'finished', label: 'Utómunka és összeállítások'},
];
const button = 'rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-40';
export default function MediaGallery({onUse, disabled = false}: {
  onUse?: (item: GalleryItem) => Promise<void>; disabled?: boolean;
}) {
  const [kind, setKind] = useState<GalleryKind>('images');
  const [items, setItems] = useState<GalleryItem[]>([]), [cursor, setCursor] = useState<string>();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [viewing, setViewing] = useState<GalleryItem | null>(null);
  const request = useRef(0), locked = useRef(false);
  async function load(category: GalleryKind, next?: string) {
    const version = ++request.current;
    locked.current = true; setBusy(true); setError('');
    try {
      const query = new URLSearchParams({kind: category, ...(next ? {cursor: next} : {})});
      const result = await fetch('/api/ai-video/gallery?' + query, {cache: 'no-store'});
      if (!result.ok) throw new Error('A galéria nem tölthető be. Próbáld újra a frissítést.');
      const data: GalleryPage = await result.json();
      if (request.current !== version) return;
      setItems(old => next ? [...new Map([...old, ...data.items].map(item => [item.id, item])).values()] : data.items);
      setCursor(data.nextCursor);
    } catch (e) { if (request.current === version) setError((e as Error).message); }
    finally { if (request.current === version) { locked.current = false; setBusy(false); } }
  }
  useEffect(() => { setItems([]); setViewing(null); setCursor(undefined); void load(kind);
    return () => { request.current++; };
  }, [kind]);
  async function use(item: GalleryItem) {
    if (locked.current || disabled || !onUse) return;
    locked.current = true; setBusy(true); setError('');
    try { await onUse(item); } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function preserve(item: GalleryItem) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai-video/gallery', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jobId: item.jobId})});
      if (!response.ok || !(await response.json()).archived) throw new Error('A tartós másolat még nem készült el. A szolgáltatói fájl elérhetőségét ellenőrizni kell.');
      setItems(old => old.map(row => row.id === item.id ? {...row, archived: true} : row));
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section aria-label="Megőrzött képek és videók" className="space-y-4">
    <p className="text-sm text-zinc-400">A képek, eredeti videók és utómunka-változatok megmaradnak másik jelenet vagy új változat készítésekor is. Az előnézet és az újrahasználat nem indít generálást.</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Médiatípus">
      {tabs.map(tab => <button type="button" className={button + (kind === tab.kind ? ' border-amber-400 text-amber-200' : '')} aria-pressed={kind === tab.kind} disabled={busy} key={tab.kind} onClick={() => setKind(tab.kind)}>{tab.label}</button>)}
      <button type="button" className={button} disabled={busy} onClick={() => void load(kind)}>Galéria frissítése</button>
    </div>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {viewing && <div className="rounded-xl border border-zinc-700 bg-black p-3">
      <button type="button" className={button + ' mb-3'} onClick={() => setViewing(null)}>Előnézet bezárása</button>
      {viewing.kind === 'images' ? <img className="max-h-[65vh] w-full object-contain" src={viewing.url} alt={viewing.title}/> : <video key={viewing.url} className="max-h-[65vh] w-full" controls playsInline preload="metadata" src={viewing.url}/>}
    </div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item.id} className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      {item.kind === 'images' ? <button type="button" className="block w-full" onClick={() => setViewing(item)} aria-label={'Kép előnézete ' + item.id.slice(0, 8)}><img loading="lazy" className="aspect-video w-full rounded bg-zinc-950 object-contain" src={item.url} alt="Megőrzött kép"/></button> : <button type="button" className="flex aspect-video w-full items-center justify-center rounded bg-zinc-950 text-amber-200" onClick={() => setViewing(item)}>▶ Videó lejátszása</button>}
      <p className="mt-3 line-clamp-3 text-sm">{item.title}</p>
      <p className="mt-1 text-xs text-zinc-400">{item.createdAt ? new Date(item.createdAt).toLocaleString('hu-HU') : ''} · {item.id.slice(0, 8)}</p>
      <p className={'mt-2 text-xs ' + (item.archived ? 'text-emerald-300' : 'text-amber-200')}>{item.archived ? 'Tartósan megőrizve' : 'Még szolgáltatói hivatkozás · tartós mentés szükséges'}</p>
      <div className="mt-3 flex flex-wrap gap-2"><a className={button} href={item.url} download={'WonderlyTales-' + item.id.slice(0, 12) + (item.kind === 'images' ? '' : '.mp4')}>Letöltés</a>
        {!item.archived && <button type="button" className={button} disabled={busy} onClick={() => void preserve(item)}>Tartós másolat mentése</button>}
        {onUse && item.kind !== 'finished' && <button type="button" className={button} disabled={busy || disabled} onClick={() => void use(item)}>{item.kind === 'images' ? 'Kép használata új beállításhoz' : 'Videó használata ebben a jelenetben'}</button>}
      </div>
    </article>)}</div>
    {!items.length && !busy && <p className="text-sm text-zinc-400">Ezen az oldalon nincs megjeleníthető média.{cursor ? ' A további fájlokat a következő gombbal töltheted be.' : ''}</p>}
    {cursor && <button type="button" className={button} disabled={busy} onClick={() => void load(kind, cursor)}>További fájlok betöltése</button>}
    {busy && <p role="status" className="text-amber-200">A galéria frissítése…</p>}
  </section>;
}
