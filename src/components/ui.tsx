import Link from "next/link";
import { getStudioUser, authEnabled } from "@/lib/auth";
import type { ReactNode } from "react";

const NAV = [
  ["Dashboard","/"],["Series","/series"],["Characters","/characters"],["Locations","/locations"],
  ["Props","/props"],["Animations","/animations"],["Voices","/voices"],["Render Queue","/render-queue"],
  ["Filmgyártás","/production"],["QC","/qc"],["Localization","/localization"],["Costs","/costs"],["Settings","/settings"],
] as const;

export async function Shell({ children }: { children: ReactNode }) {
  const user = await getStudioUser();
  return (
    <div className="min-h-screen flex">
      <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-925 bg-zinc-900/40 p-4 hidden md:block">
        <div className="mb-6">
          <div className="text-lg font-bold tracking-tight">Wonderly Tales</div>
          <div className="text-xs text-amber-400 font-medium">STUDIO</div>
        </div>
        <nav className="space-y-1">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} className="block px-3 py-2 rounded text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white min-h-[44px] md:min-h-0 flex items-center">{label}</Link>
          ))}
        </nav>
        <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-500">
          <div className="px-3">{authEnabled() ? user?.email : "dev mód (auth kikapcsolva)"}</div>
          {authEnabled() && <a href="/logout" className="block px-3 py-2 text-zinc-400 hover:text-white">Kijelentkezés</a>}
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="md:hidden border-b border-zinc-800 p-3 flex gap-2 overflow-x-auto">
          {NAV.map(([label, href]) => (<Link key={href} href={href} className="px-3 py-2 text-sm whitespace-nowrap rounded bg-zinc-900">{label}</Link>))}
        </header>
        <main className="p-4 md:p-8 max-w-7xl">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (<div className="mb-6"><h1 className="text-2xl font-bold">{title}</h1>{sub && <p className="text-sm text-zinc-400 mt-1">{sub}</p>}</div>);
}
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>{children}</div>;
}
export function Badge({ text, tone = "zinc" }: { text: string; tone?: "zinc"|"green"|"amber"|"red"|"blue"|"purple" }) {
  const tones = { zinc: "bg-zinc-700/50 text-zinc-300", green: "bg-emerald-900/60 text-emerald-300", amber: "bg-amber-900/60 text-amber-300", red: "bg-red-900/60 text-red-300", blue: "bg-sky-900/60 text-sky-300", purple: "bg-violet-900/60 text-violet-300" };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tones[tone]}`}>{text}</span>;
}
export function statusTone(s: string): "zinc"|"green"|"amber"|"red"|"blue"|"purple" {
  if (["READY","SUCCEEDED","PASS","LOCKED","ACTIVE","FINAL_READY","APPROVED_FOR_FINAL"].includes(s)) return "green";
  if (["RUNNING","GENERATING","PREVIEW_RENDERING","FINAL_RENDERING","QC_RUNNING","CLAIMED","QUEUED","PENDING","IN_PRODUCTION"].includes(s)) return "blue";
  if (["WARNING","QC_WARNING","RETRY_WAIT","DRAFT","MISSING","PLANNED"].includes(s)) return "amber";
  if (["FAIL","FAILED","QC_FAILED","CANCELLED","ERROR"].includes(s)) return "red";
  return "zinc";
}
export function SubmitButton({ label, className = "" }: { label: string; className?: string }) {
  return <button type="submit" className={`px-3 py-2 rounded bg-amber-500 text-zinc-950 text-sm font-semibold hover:bg-amber-400 min-h-[44px] md:min-h-0 ${className}`}>{label}</button>;
}
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead><tr className="bg-zinc-900 text-left text-zinc-400">{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-800">{children}</tbody>
      </table>
    </div>
  );
}
