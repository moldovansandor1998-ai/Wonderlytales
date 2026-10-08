'use client';
import { useState } from 'react';

type Receipt = { key: string; sha256: string; bytes: number };
export default function NativeAssetsPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  async function upload() {
    setBusy(true);
    try {
      for (const file of files) {
        const part = /^([A-Za-z0-9_-]+\.blend)__([a-f0-9]{64})__(\d+)__(\d+)\.part$/.exec(file.name);
        if (part) {
          const [, name, digest, total, index] = part;
          const base = new URLSearchParams({ sha256: digest, name, size: total });
          setStatus(`${name} — ${Number(index) + 1}. adatdarab`);
          const response = await fetch(`/api/native-assets/upload?${base}&action=chunk&index=${index}`, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file,
          });
          if (!response.ok) throw new Error('Az adatdarab feltöltése nem sikerült.');
          if ((Number(index) + 1) * 3 * 1024 * 1024 >= Number(total)) {
            setStatus(`${name} — teljes fájl ellenőrzése`);
            const completed = await fetch(`/api/native-assets/upload?${base}&action=complete`, { method: 'POST' });
            if (!completed.ok) throw new Error('A teljes fájl ellenőrzése nem sikerült; a feltöltött darabok megmaradtak.');
            const receipt = await completed.json() as Receipt;
            setReceipts(previous => [...previous.filter(r => r.key !== receipt.key), receipt]);
          }
          continue;
        }
        if (!/^[A-Za-z0-9_-]+\.blend$/.test(file.name) || file.size > 200 * 1024 * 1024) throw new Error('Legfeljebb 200 MB-os Blender-fájlt válassz.');
        setStatus(`${file.name} — ellenőrzés`);
        const bytes = await file.arrayBuffer();
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('');
        const chunkSize = 3 * 1024 * 1024;
        const base = new URLSearchParams({ sha256: digest, name: file.name, size: String(file.size) });
        for (let offset = 0, index = 0; offset < file.size; offset += chunkSize, index++) {
          const response = await fetch(`/api/native-assets/upload?${base}&action=chunk&index=${index}`, {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(offset, offset + chunkSize),
          });
          if (!response.ok) throw new Error('A feltöltés megszakadt. A kész részek megmaradtak; újra próbálhatod.');
          setStatus(`${file.name} — ${Math.round(Math.min(offset + chunkSize, file.size) / file.size * 100)}%`);
        }
        setStatus(`${file.name} — mentés és ellenőrzés`);
        const response = await fetch(`/api/native-assets/upload?${base}&action=complete`, { method: 'POST' });
        if (!response.ok) throw new Error('A fájl mentése vagy ellenőrzése nem sikerült.');
        const receipt = await response.json() as Receipt;
        setReceipts(previous => [...previous.filter(r => r.key !== receipt.key), receipt]);
      }
      setStatus('A kijelölt fájlok átvitele sikerült. Teljes jelenet csak a mentési igazolás megjelenése után áll rendelkezésre.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'A feltöltés nem sikerült.'); }
    finally { setBusy(false); }
  }
  return <main className="max-w-3xl mx-auto p-6 space-y-5">
    <h1 className="text-2xl font-semibold">Epizód jelenetfájljai</h1>
    <p>A kész Blender-jelenetek feltöltése a rendereléshez. A feltöltés önmagában nem hagyja jóvá a jelenet minőségét.</p>
    <label className="block">Blender-jelenetek
      <input aria-label="Blender-jelenetek" className="block mt-2" type="file" accept=".blend,.part" multiple disabled={busy}
        onChange={event => setFiles(Array.from(event.target.files ?? []))} />
    </label>
    <button disabled={busy || !files.length} onClick={upload} className="rounded bg-amber-500 text-black px-4 py-2 disabled:opacity-50">Feltöltés</button>
    <p role="status">{status}</p>
    {receipts.map(receipt => <article key={receipt.key} className="border border-slate-600 rounded p-3 break-all">
      <p>{receipt.key.split('/').pop()}</p><p>Mentve · {(receipt.bytes / 1024 / 1024).toFixed(1)} MB</p>
      <details><summary>Renderelési azonosító</summary><pre className="whitespace-pre-wrap">{JSON.stringify(receipt, null, 2)}</pre></details>
    </article>)}
  </main>;
}
