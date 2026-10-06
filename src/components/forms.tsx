"use client";
import { useState, useTransition } from "react";

/** Visszajelzést adó submit gomb: loading + success/error állapot */
export function ActionButton({ label, action, className = "bg-zinc-700 hover:bg-zinc-600", confirmText }: {
  label: string;
  action: () => Promise<string | void>;
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
            try { const r = await action(); setMsg({ ok: true, text: typeof r === "string" ? r : "Kész" }); }
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
  return <ActionButton label="Voice Test" action={action} className="bg-sky-700 hover:bg-sky-600" />;
}
