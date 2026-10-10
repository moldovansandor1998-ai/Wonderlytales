'use client';
import { useState } from 'react';
export function SpeechReviewButton({action}:{action:(cursor:number)=>Promise<{completed:number;total:number;done:boolean;results:{usable:boolean}[]}>}) {
  const [running,setRunning]=useState(false),[message,setMessage]=useState('');
  return <div className="my-4"><button disabled={running} className="bg-zinc-700 px-4 py-3 rounded disabled:opacity-50" onClick={async()=>{
    setRunning(true);let cursor=0,flagged=0;
    try {
      let result;
      do {
        result=await action(cursor);
        if(result.completed<=cursor&&!result.done) throw new Error('Az ellenőrzés nem haladt tovább. Újraindítható.');
        cursor=result.completed;flagged+=result.results.filter(r=>!r.usable).length;
        setMessage(`${cursor}/${result.total} felvétel ellenőrizve · ${flagged} felülvizsgálatra vár`);
      } while(!result.done);
      setMessage(`${cursor}/${result.total} ellenőrizve · ${flagged} felülvizsgálatra vár. A kész időzítések elmentve.`);
    } catch(e) {setMessage(e instanceof Error?e.message:'Az ellenőrzés megszakadt. A mentett eredmények megmaradnak.');}
    finally {setRunning(false);}
  }}>{running?'Felvételek ellenőrzése…':'Mentett magyar hangok és időzítések ellenőrzése / folytatása'}</button>
  <p role="status" className="mt-2">{message}</p></div>;
}
