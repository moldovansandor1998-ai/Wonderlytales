"use client";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-8">
      <div className="rounded-lg border border-red-800 bg-red-950/40 p-6 max-w-lg">
        <h2 className="font-semibold text-red-300 mb-2">Hiba történt</h2>
        <p className="text-sm text-zinc-300 mb-4">{error.message}</p>
        <button onClick={reset} className="px-4 py-2 rounded bg-zinc-700 text-sm min-h-[44px]">Újrapróbálás</button>
      </div>
    </div>
  );
}
