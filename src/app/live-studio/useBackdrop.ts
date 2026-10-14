"use client";
import { useEffect, useRef, useState } from "react";
type Result = { status: string; url?: string; error?: string };
export function useBackdrop() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  const saved = useRef("");
  useEffect(() => () => { if (saved.current) URL.revokeObjectURL(saved.current); }, []);
  async function cacheVideo(source: string, signal: AbortSignal) {
    setStatus("Az alapvideó betöltése a böngészőbe…");
    const response = await fetch(source, {signal, cache:"no-store"});
    if (!response.ok || !response.headers.get("Content-Type")?.startsWith("video/")) throw new Error("A mentett alapvideó letöltése nem sikerült. Új generálás nem indult.");
    const bytes = await response.blob();
    signal.throwIfAborted();
    if (!bytes.size) throw new Error("A mentett alapvideó üres.");
    const local = URL.createObjectURL(bytes);
    if (saved.current) URL.revokeObjectURL(saved.current);
    saved.current = local; setUrl(local); return local;
  }
  async function read(signal: AbortSignal, create = false): Promise<Result> {
    const response = await fetch("/api/live-studio/backdrop", { signal, cache: "no-store", ...(create ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
    const result: Result = await response.json();
    if (!response.ok) throw new Error(result.error === "BACKDROP_BUDGET_NOT_CONFIGURED" ? "A mozgó alapjelenet költségkerete nem ellenőrizhető." : "A mozgó alapjelenet nem érhető el. Új fizetős generálás nem indul automatikusan.");
    return result;
  }
  async function ensure(signal: AbortSignal, createIfMissing = true) {
    signal.throwIfAborted();
    if (saved.current) return saved.current;
    setStatus("Mozgó alapjelenet betöltése…");
    try {
      let result = await read(signal);
      if (result.status === "MISSING") {
        if (!createIfMissing) throw new Error("Még nincs mentett alapvideó. Új generálás nem indult.");
        setStatus("Az egyszeri mozgó alapjelenet készül. A következő adások ezt újra használják.");
        result = await read(signal, true);
      }
      const deadline = Date.now() + 240000;
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        if (result.status === "SUCCEEDED" && result.url) return await cacheVideo(result.url, signal);
        if (["UNCERTAIN", "FAILED"].includes(result.status)) throw new Error("Az alapjelenet készítése nem sikerült vagy ellenőrzést igényel. Nem indult új generálás.");
        await new Promise<void>((resolve, reject) => {
          const cancel = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
          const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 2500);
          signal.addEventListener("abort", cancel, { once: true });
          if (signal.aborted) cancel();
        });
        result = await read(signal);
      }
      throw new Error("Az alapjelenet még készül. A következő indítás ugyanazt a feladatot ellenőrzi, új generálás nélkül.");
    } finally { setStatus(""); }
  }
  return { url, status, ensure };
}
