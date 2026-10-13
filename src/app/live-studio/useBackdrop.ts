"use client";
import { useState } from "react";
type Result = { status: string; url?: string; error?: string };
export function useBackdrop() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  async function read(signal: AbortSignal, create = false): Promise<Result> {
    const response = await fetch("/api/live-studio/backdrop", { signal, cache: "no-store", ...(create ? { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" } : {}) });
    const result: Result = await response.json();
    if (!response.ok) throw new Error(result.error === "BACKDROP_BUDGET_NOT_CONFIGURED" ? "A mozgó alapjelenet költségkerete nem ellenőrizhető." : "A mozgó alapjelenet nem érhető el. Új fizetős generálás nem indul automatikusan.");
    return result;
  }
  async function ensure(signal: AbortSignal) {
    signal.throwIfAborted();
    if (url) return url;
    setStatus("Mozgó alapjelenet betöltése…");
    try {
      let result = await read(signal);
      if (result.status === "MISSING") {
        setStatus("Az egyszeri mozgó alapjelenet készül. A következő adások ezt újra használják.");
        result = await read(signal, true);
      }
      const deadline = Date.now() + 240000;
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        if (result.status === "SUCCEEDED" && result.url) { setUrl(result.url); return result.url; }
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
