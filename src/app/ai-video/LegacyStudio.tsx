'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
const VideoStudio=dynamic(()=>import('./VideoStudio'),{loading:()=> <p className="p-4 text-sm text-zinc-400">A szabad videógenerátor betöltése…</p>});
export default function LegacyStudio(){
 const [opened,setOpened]=useState(false);
 return <details className="mt-8 rounded-xl border border-zinc-800 p-4" onToggle={e=>{if(e.currentTarget.open)setOpened(true);}}><summary className="cursor-pointer font-semibold">Szabad videógenerátor és hangbeállítások</summary>{opened&&<div className="mt-5"><VideoStudio/></div>}</details>;
}
