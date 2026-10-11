"use client";
import { useState, useTransition } from "react";

/** Visszajelzést adó submit gomb: loading + success/error állapot */
export function ActionButton({ label, action, className = "bg-zinc-700 hover:bg-zinc-600", confirmText }: {
  label: string;
  action: () => Promise<string | void | { ok: boolean; message: string }>;
  className?: string;
  confirmText?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            try { const r = await action(); setMsg(r && typeof r === "object" ? { ok: r.ok, text: r.message } : { ok: true, text: typeof r === "string" ? r : "Kész" }); }
            catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Hiba" }); }
          });
        }}
        className={`px-3 py-2 rounded text-sm font-semibold min-h-[44px] md:min-h-0 ${className} ${pending ? "opacity-60" : ""}`}
      >{pending ? "…" : label}</button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
    </span>
  );
}

/** Voice Test gomb: szöveg → Generate → audio path */
export function VoiceTestButton({ action }: { action: () => Promise<string> }) {
  const [url, setUrl] = useState<string | null>(null);
  return <div><ActionButton label="Voice Test" action={async () => { setUrl(await action()); return "Hangminta elmentve"; }} className="bg-sky-700 hover:bg-sky-600" />
    {url && <audio controls preload="none" src={url} className="mt-2 max-w-full" />}</div>;
}
