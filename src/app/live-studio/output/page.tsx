"use client";
import { useEffect, useState } from "react";
import Stage from "../Stage";
import { initialStage, type StageState } from "@/lib/live/stage";
export default function OutputPage() {
  const [state, setState] = useState(initialStage);
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let channel: BroadcastChannel | undefined;
    let last = 0;
    const connect = () => {
      channel?.close(); channel = undefined; last = 0;
      setOnline(false); setState(initialStage);
      const id = location.hash.slice(1);
      if (!/^[a-f0-9-]{36}$/.test(id)) return;
      channel = new BroadcastChannel(`wonderly-live-${id}`);
      channel.onmessage = ({data}) => { if (data?.type === "state") { setState(data.state as StageState); last = Date.now(); setOnline(true); } };
      channel.postMessage({type: "ready"});
    };
    connect();
    window.addEventListener("hashchange", connect);
    const timer = setInterval(() => { if (Date.now() - last > 6000) { setOnline(false); setState(s => ({...s, speaking: false, connected: false, effect: undefined, motion: undefined, npc:s.npc?{...s.npc,active:false}:undefined, backdrop:s.backdrop ? {...s.backdrop,active:false}:undefined, showStatus:"A vezérlő kapcsolata megszakadt."})); } }, 2000);
    return () => { window.removeEventListener("hashchange", connect); clearInterval(timer); channel?.close(); };
  }, []);
  return <main className="fixed inset-0 z-[100] flex justify-center bg-black text-white"><Stage state={state} full />{!online && <div className="absolute inset-x-0 bottom-0 bg-red-950/95 p-2 text-center text-sm">Nyisd meg az adásképet az aktív élő stúdióból.</div>}</main>;
}
