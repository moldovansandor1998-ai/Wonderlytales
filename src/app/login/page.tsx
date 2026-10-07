"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import { authErrorMessage, safeAuthNext } from "@/lib/auth-navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();

  async function signIn(mode: "password" | "magic" | "recovery") {
    if (busy) return;
    const address = email.trim();
    if (!address) { setMsg("Add meg az e-mail-címedet."); return; }
    setBusy(true); setMsg("");
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!);
      if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        // A full navigation lets the server read the new session cookies.
        location.assign(safeAuthNext(params.get("next")));
      } else if (mode === "recovery") {
        const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${location.origin}/auth/callback?next=/auth/update-password` });
        if (error) throw error;
        setMsg("Ha ehhez az e-mailhez tartozik fiók, elküldtük a helyreállító linket. Nyisd meg ugyanebben a böngészőben, majd állíts be új Studio-jelszót.");
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setMsg("Magic link elküldve – nézd meg az e-mailedet.");
      }
    } catch (e) { setMsg(authErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="text-xl font-bold">Wonderly Tales <span className="text-amber-400">STUDIO</span></div>
        <p className="text-sm text-zinc-400 mt-1 mb-6">Jelentkezz be a Studio felületre.</p>
        <form onSubmit={(e) => { e.preventDefault(); void signIn("password"); }}>
        {(msg || params.get("error") === "link") && <div role="status" aria-live="polite" className="mb-4 text-sm text-amber-300">{msg || "A belépőlink lejárt vagy nem ellenőrizhető. Kérj új linket, és ugyanebben a böngészőben nyisd meg."}</div>}
        <label htmlFor="email" className="block text-xs text-zinc-400 mb-1">E-mail</label>
        <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm w-full mb-3" id="email" name="email" autoComplete="username" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password" className="block text-xs text-zinc-400 mb-1">Jelszó</label>
        <input className="bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-sm w-full mb-4" id="password" name="password" autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy} className="w-full py-2.5 rounded bg-amber-500 text-zinc-950 font-semibold text-sm mb-2 min-h-[44px]">Belépés</button>
        <button type="button" disabled={busy} onClick={() => void signIn("magic")} className="w-full py-2.5 rounded bg-zinc-800 text-sm min-h-[44px]">E-mailes belépőlink küldése</button>
        <button type="button" disabled={busy} onClick={() => void signIn("recovery")} className="w-full py-2.5 text-amber-300 text-sm min-h-[44px]">Elfelejtett jelszó</button>
        </form>
      </div>
    </div>
  );
}
