"use client";
import { useEffect, useRef, useState } from "react";
import { eventSchema, type LiveEvent } from "@/lib/live/events";
export type ConnectionMode = "cloud" | "local";
export function useTikTokConnection(onEvent:(event:LiveEvent)=>void,onTerminal:(message:string)=>void) {
  const [connected,setConnected] = useState(false);
  const [status,setStatus] = useState("Nincs kapcsolat");
  const [busy,setBusy] = useState(false);
  const socket = useRef<WebSocket|null>(null);
  const retry = useRef<ReturnType<typeof setTimeout>>();
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  const eventRef = useRef(onEvent); eventRef.current = onEvent;
  const terminalRef = useRef(onTerminal); terminalRef.current = onTerminal;
  useEffect(()=>()=>{generation.current++;clearTimeout(retry.current);clearTimeout(timeout.current);socket.current?.close();},[]);
  function disconnect() {
    generation.current++; clearTimeout(retry.current);clearTimeout(timeout.current);
    const current=socket.current;socket.current=null;current?.close();
    setConnected(false);setBusy(false);setStatus("Nincs kapcsolat");
  }
  function connect(mode:ConnectionMode,username:string,token:string,probe=false) {
    const name=username.replace(/^@/,"").trim();
    if (!probe && (!/^[a-zA-Z0-9_.]{2,32}$/.test(name) || (mode==="local"&&!token.trim()))) {
      setStatus(mode==="local"?"Add meg a TikTok felhasználónevet és a párosítási kódot.":"Add meg a TikTok felhasználónevet.");return;
    }
    disconnect();const run=generation.current;
    let failures=0;
    const open = () => {
      if(run!==generation.current)return;
      setBusy(true);setStatus(probe?"Telefonos kapcsolat ellenőrzése…":"Kapcsolódás…");
      const url=mode==="local"?"ws://127.0.0.1:21214":`${location.protocol==="https:"?"wss:":"ws:"}//${location.host}/api/live-studio/tiktok`;
      const ws=new WebSocket(url);socket.current=ws;let terminal=false,received=false;
      timeout.current=setTimeout(()=>{if(run===generation.current&&socket.current===ws){terminal=true;setBusy(false);const message="A kapcsolat nem válaszol. Ellenőrizd a hálózatot és a bejelentkezést.";setStatus(message);terminalRef.current(message);ws.close();}},40000);
      ws.onopen=()=>ws.send(JSON.stringify(probe?{type:"probe"}:{type:"connect",username:name,...(mode==="local"?{token:token.trim()}:{})}));
      ws.onmessage=({data})=>{
        if(run!==generation.current||socket.current!==ws||typeof data!=="string"||data.length>10000)return;
        try {
          const value=JSON.parse(data);
          if(value.type==="probe"&&value.ok===true){received=true;terminal=true;clearTimeout(timeout.current);setBusy(false);setStatus(String(value.message).slice(0,300));}
          if(value.type==="status"){
            received=true;setConnected(value.connected===true);setStatus(String(value.message||"").slice(0,300));
            if(value.connected===true){failures=0;clearTimeout(timeout.current);setBusy(false);}
            if(value.terminal===true){terminal=true;clearTimeout(timeout.current);setBusy(false);terminalRef.current(String(value.message||"A TikTok-kapcsolat megállt.").slice(0,300));}
          }
          if(value.type==="event"){const parsed=eventSchema.safeParse(value.event);if(parsed.success)eventRef.current(parsed.data);}
        }catch{/* Invalid remote messages cannot enter the paid reply queue. */}
      };
      ws.onclose=event=>{
        if(run!==generation.current||socket.current!==ws)return;
        clearTimeout(timeout.current);setConnected(false);setBusy(false);
        if(terminal)return;
        if(mode==="cloud"&&!probe&&(event.code===1012||(event.code===1006&&received))&&failures<3){
          const delay=Math.min(5000*2**failures++,20000);setStatus("A szerverkapcsolat megújítása…");retry.current=setTimeout(open,delay);
        }else{const message=mode==="local"?"A helyi összekötő nem érhető el. Telefonon válaszd a szerveres kapcsolatot.":"A szerverkapcsolat megszakadt. Ellenőrizd a bejelentkezést, majd csatlakozz újra.";setStatus(message);terminalRef.current(message);}
      };
      ws.onerror=()=>{/* onclose handles network failures without duplicate reconnects. */};
    };
    open();
  }
  return {connected,status,busy,connect,disconnect};
}
