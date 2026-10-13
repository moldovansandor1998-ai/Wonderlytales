"use client";
import { useEffect, useState } from "react";
import Stage from "../Stage";
import { initialStage, type StageState } from "@/lib/live/stage";
export default function OutputPage() {
  const [state, setState] = useState(initialStage);
  const [online, setOnline] = useState(false);
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!/^[a-f0-9-]{36}$/.test(id)) return;
    const channel = new BroadcastChannel(`wonderly-live-${id}`);
    let last = 0;
    channel.onmessage = ({data}) => { if (data?.type === "state") { setState(data.state as StageState); last = Date.now(); setOnline(true); } };
    channel.postMessage({type: "ready"});
    const timer = setInterval(() => { if (Date.now() - last > 6000) { setOnline(false); setState(s => ({...s, speaking: false, connected: false, effect: undefined})); } }, 2000);
    return () => { clearInterval(timer); channel.close(); };
  }, []);
  return <main className="fixed inset-0 z-[100] flex justify-center bg-black text-white"><Stage state={state} full />{!online && <div className="absolute inset-x-0 bottom-0 bg-red-950/95 p-2 text-center text-sm">Nyisd meg az adásképet az aktív élő stúdióból.</div>}</main>;
}
