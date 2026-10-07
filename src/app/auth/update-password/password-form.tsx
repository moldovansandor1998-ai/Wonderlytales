"use client";
import { useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { authErrorMessage } from "@/lib/auth-navigation";

export default function PasswordForm({ embedded = false }: { embedded?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved) return;
    if (password !== confirmation) { setMessage("A két jelszó nem egyezik."); return; }
    setBusy(true); setMessage("");
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword(""); setConfirmation(""); setSaved(true);
      setMessage("Az új Studio-jelszót elmentettük.");
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <section className={embedded ? "" : "min-h-screen flex items-center justify-center p-4"}>
    <div className={embedded ? "w-full max-w-sm" : "w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900/60 p-6"}>
      <h1 className="text-xl font-bold">Új Studio-jelszó</h1>
      <p className="text-sm text-zinc-400 mt-1 mb-6">A bejelentkezett fiókodhoz állíthatsz be új jelszót. A régi jelszót nem kell megadnod.</p>
      {message && <p role="status" aria-live="polite" className="text-sm text-amber-300 mb-4">{message}</p>}
      {saved ? <a href="/" className="block text-center rounded bg-amber-500 text-zinc-950 p-3">Tovább a stúdióba</a> :
        <form onSubmit={submit}>
          <label htmlFor="new-password" className="block text-sm mb-1">Új jelszó</label>
          <input id="new-password" name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded p-2 w-full mb-3" />
          <label htmlFor="confirmation" className="block text-sm mb-1">Új jelszó még egyszer</label>
          <input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded p-2 w-full mb-4" />
          <button disabled={busy} className="w-full min-h-[44px] rounded bg-amber-500 text-zinc-950 font-semibold">{busy ? "Mentés…" : "Új jelszó mentése"}</button>
        </form>}
    </div>
  </section>;
}
