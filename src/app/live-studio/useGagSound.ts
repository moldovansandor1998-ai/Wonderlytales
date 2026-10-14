"use client";
import { useEffect, useRef } from "react";
import { GAG_META, type GagKind } from "@/lib/live/npc-shared";

/** Local cartoon foley: no paid generation or extra network wait during the live. */
export function useGagSound() {
  const context=useRef<AudioContext>();
  const stopRef=useRef<()=>void>();
  useEffect(()=>()=>{stopRef.current?.();void context.current?.close();},[]);
  async function unlock(){
    context.current ||= new AudioContext();
    if(context.current.state==="suspended")await context.current.resume();
  }
  function play(kind:GagKind,signal:AbortSignal){
    stopRef.current?.();
    const ctx=context.current;
    if(!ctx||ctx.state!=="running"||signal.aborted)return ()=>{};
    const bus=ctx.createGain();bus.gain.value=0.24;bus.connect(ctx.destination);
    const sources:AudioScheduledSourceNode[]=[];
    const now=ctx.currentTime,meta=GAG_META[kind],impact=meta.impact*meta.playbackSeconds/meta.duration;
    let stopped=false;
    const stop=()=>{if(stopped)return;stopped=true;clearTimeout(timer);signal.removeEventListener("abort",stop);for(const node of sources){try{node.stop();}catch{/* already ended */}node.disconnect();}bus.disconnect();};
    const tone=(at:number,duration:number,from:number,to:number,type:OscillatorType="sine",level=0.7)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;
      osc.frequency.setValueAtTime(from,now+at);osc.frequency.exponentialRampToValueAtTime(to,now+at+duration);
      gain.gain.setValueAtTime(0.001,now+at);gain.gain.linearRampToValueAtTime(level,now+at+0.015);gain.gain.exponentialRampToValueAtTime(0.001,now+at+duration);
      osc.connect(gain);gain.connect(bus);osc.start(now+at);osc.stop(now+at+duration);sources.push(osc);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    };
    const noise=(at:number,duration:number,frequency:number,level=0.55)=>{
      const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
      const node=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();node.buffer=buffer;filter.type="lowpass";filter.frequency.value=frequency;gain.gain.value=level;
      node.connect(filter);filter.connect(gain);gain.connect(bus);node.start(now+at);sources.push(node);node.onended=()=>{node.disconnect();filter.disconnect();gain.disconnect();};
    };
    if(kind==="gag-beg"){
      tone(impact,0.25,180,70,"triangle",0.25);
    }else if(kind==="gag-spin"||kind==="gag-tornado"){
      for(let i=0;i<5;i++)tone(0.4+i*0.35,0.3,240+i*90,650-i*60,"triangle",0.45);
      tone(meta.playbackSeconds-0.9,0.65,300,65);
    }else if(kind==="gag-galaxy"||kind==="gag-rocket"){
      tone(impact,0.15,110,35,"sine",1);noise(impact,0.4,700);
      tone(impact+0.15,1.2,150,1400,"triangle",0.4);
      for(let i=0;i<8;i++)tone(impact+0.3+i*0.15,0.25,750+i*120,900+i*120,"sine",0.15);
      tone(meta.playbackSeconds-1.1,0.55,900,70,"sine",0.5);noise(meta.playbackSeconds-0.6,0.3,500);
    }else if(kind==="gag-cream"){
      noise(impact,1.8,2800,0.5);tone(3.15,0.2,850,650,"sine",0.35);
    }else if(kind==="gag-bubble"){
      tone(0.3,1.9,180,850,"sine",0.25);noise(2.9,0.2,1600);tone(3.15,0.8,600,80,"sine",0.4);
    }else if(kind==="gag-confetti"){
      noise(impact,0.3,2400,0.8);for(let i=0;i<6;i++)tone(impact+0.2+i*0.15,0.18,800+i*100,600,"triangle",0.18);
    }else{
      noise(impact,kind==="gag-slime"?1.4:0.55,kind==="gag-mud"?550:1400,0.75);
      tone(impact,0.3,130,35,"sine",0.8);
      if(kind==="gag-meteor")for(let i=1;i<4;i++){noise(impact+i*0.75,0.4,1200);tone(impact+i*0.75,0.2,150,45);}
    }
    const timer=setTimeout(stop,meta.playbackSeconds*1000+100);
    signal.addEventListener("abort",stop,{once:true});stopRef.current=stop;
    return stop;
  }
  return {unlock,play};
}
