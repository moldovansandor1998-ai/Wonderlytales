"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function Refresh() {
 const router=useRouter();
 useEffect(() => { const timer=setInterval(() => { if(document.visibilityState === "visible") router.refresh(); },15000); return () => clearInterval(timer); },[router]);
 return <button className="text-amber-400 text-sm" onClick={() => router.refresh()}>Állapot frissítése</button>;
}
