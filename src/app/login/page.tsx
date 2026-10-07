"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function signIn(mode: "password" | "magic") {
    setBusy(true); setMsg("");
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!);
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(params.get("next") ?? "/"); router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setMsg("Magic link elküldve – nézd meg az e-mailedet.");
      }
    } catch (e) { setMsg(e instanceof Error ? e.message : "Hiba"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="text-xl font-bold">Wonderly Tales <span className="text-amber-400">STUDIO</span></div>
        <p className="text-sm text-zinc-400 mt-1 mb-6">Jelentkezz be a Studio felületre.</p>
        {msg && <div className="mb-4 text-sm text-amber-300">{msg}</div>}
        <label className="block text-xs text-zinc-400 mb-1">E-mail</label>
        <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm w-full mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block text-xs text-zinc-400 mb-1">Jelszó</label>
        <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm w-full mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button disabled={busy} onClick={() => signIn("password")} className="w-full py-2.5 rounded bg-amber-500 text-zinc-950 font-semibold text-sm mb-2 min-h-[44px]">Belépés</button>
        <button disabled={busy} onClick={() => signIn("magic")} className="w-full py-2.5 rounded bg-zinc-800 text-sm min-h-[44px]">Magic link küldése</button>
      </div>
    </div>
  );
}
