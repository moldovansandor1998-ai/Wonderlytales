'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GALLERY_LABELS, type GalleryItem, type GalleryKind, type GalleryPage } from '@/lib/ai-video/gallery-shared';
const button = 'rounded-lg border border-zinc-700 px-4 py-3 text-sm hover:bg-zinc-800 disabled:opacity-40';
export default function Gallery() {
  const [kind, setKind] = useState<GalleryKind>('videos');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestId = useRef(0);
  const load = useCallback(async (next?: string) => {
    const id = ++requestId.current;
    setBusy(true); setError('');
    try {
      const query = new URLSearchParams({ kind, ...(next ? { cursor: next } : {}) });
      const r = await fetch(`/api/ai-video/gallery?${query}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('A galéria nem tölthető be. Próbáld újra a frissítést.');
      const page: GalleryPage = await r.json();
      // Older free-form clips may only have a provider URL. Save them once, without generation.
      const preserved: GalleryItem[] = [];
      for (let offset = 0; offset < page.items.length; offset += 4) preserved.push(...await Promise.all(page.items.slice(offset, offset + 4).map(async item => {
        if (item.archived) return item;
        try { const r = await fetch('/api/ai-video/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) }); return r.ok ? { ...item, archived: true } : item; }
        catch { return item; }
      })));
      if (id !== requestId.current) return;
      setItems(old => next ? [...old, ...preserved.filter(item => !old.some(x => x.id === item.id))] : preserved);
      setCursor(page.cursor);
    } catch (e) { if (id === requestId.current) setError((e as Error).message); }
    finally { if (id === requestId.current) setBusy(false); }
  }, [kind]);
  useEffect(() => { setItems([]); setCursor(undefined); void load(); return () => { requestId.current++; }; }, [load]);
  return <div className="space-y-5">
    <div className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-100">A lecserélt és javítandó változatok is megmaradnak. Új videó készítése vagy egy jelenet újrakezdése nem törli őket. Az azonos fájlt egyszer tároljuk.</div>
    <div className="flex flex-wrap gap-2" aria-label="Galéria típusa">{(Object.keys(GALLERY_LABELS) as GalleryKind[]).map(value => <button key={value} aria-pressed={kind === value} className={`${button} ${kind === value ? 'border-amber-500 bg-amber-950/40 text-amber-200' : ''}`} onClick={() => { setKind(value); setNotice(''); }}>{GALLERY_LABELS[value]}</button>)}<button className={button} disabled={busy} onClick={() => void load()}>Frissítés</button></div>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {notice && <p role="status" className="text-emerald-200">{notice}</p>}
    {!busy && !error && !items.length && <p className="p-8 text-center text-zinc-400">Ezen az oldalon még nincs elkészült fájl.{cursor ? ' A következő oldalon további fájlok lehetnek.' : ''}</p>}
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <article key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      {item.kind === 'images' ? <a href={item.url} target="_blank" rel="noreferrer"><img className="aspect-video w-full bg-black object-contain" src={item.url} alt={item.title} loading="lazy"/></a> : <video className="aspect-video w-full bg-black" src={item.url} controls playsInline preload="none"/>}
      <div className="space-y-3 p-4"><h2 className="font-semibold">{item.title}</h2><p className="text-xs text-zinc-400">{item.createdAt ? new Date(item.createdAt).toLocaleString('hu-HU', { timeZone: 'Asia/Saigon' }) : ''}{item.size ? ` · ${(item.size / 1024 / 1024).toFixed(1)} MB` : ''}</p>
        <p className={`text-sm ${item.archived ? 'text-emerald-300' : 'text-amber-200'}`}>{item.archived ? 'Megőrizve' : 'A tartós másolat mentése nem sikerült. Frissítéssel újrapróbálható; új generálás nem indul.'}</p>
        <div className="flex flex-wrap gap-2"><a className={button} href={`${item.url}${item.url.includes('?') ? '&' : '?'}download=1`} download>Letöltés</a><a className={button} href={`/ai-video/create?${new URLSearchParams({ kind: item.kind, id: item.id })}`}>{item.kind === 'images' ? 'Kezdőképnek használom' : 'Folytatás az utolsó képkockából'}</a></div>
        {item.kind === 'videos' && <button className="text-sm text-amber-300 underline" onClick={async () => { try { await navigator.clipboard.writeText(item.id); setNotice('Videóazonosító másolva. A jelenet „Meglévő videó hozzárendelése” mezőjébe illeszthető.'); } catch { setError('A másolás nem sikerült. Az azonosító a részleteknél kijelölhető.'); } }}>Videóazonosító másolása</button>}
        <details className="text-sm text-zinc-400"><summary className="cursor-pointer">Részletek és eredeti prompt</summary><p className="mt-2 break-all text-xs">{item.id}</p>{item.prompt && <p className="mt-3 whitespace-pre-wrap">{item.prompt}</p>}</details>
      </div>
    </article>)}</div>
    {busy && <p role="status">Galéria betöltése és a korábbi videók megőrzése…</p>}
    {cursor && <button className={button} disabled={busy} onClick={() => void load(cursor)}>További fájlok betöltése</button>}
  </div>;
}
