'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function MasterAudioButton({action}:{action:()=>Promise<{completed:number;total:number;done:boolean}>}) {
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState('');
  const router=useRouter();
  return <div><button disabled={running} className="bg-amber-500 text-black px-4 py-3 rounded disabled:opacity-50" onClick={async()=>{
    setRunning(true);
    try {
      let result;
      do { result=await action(); setMessage(`${result.completed}/${result.total} megszólalás elmentve`); } while(!result.done);
      setMessage(`${result.total}/${result.total} megszólalás elmentve. Meghallgatásra kész.`);
      router.refresh();
    } catch(e) { setMessage(e instanceof Error ? e.message : 'A gyártás megszakadt. Folytatható.'); }
    finally {setRunning(false);}
  }}>{running ? 'Magyar szinkron készül…' : 'Teljes magyar szinkron elkészítése / folytatása'}</button>
    <p role="status" className="mt-2">{message}</p></div>;
}
