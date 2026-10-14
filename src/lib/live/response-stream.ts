import { dialogueSchema, type Dialogue } from "./duo";
import { readAIResponse } from "./client";
import { audioContentType } from "./audio-format";

/** Split one server response into incremental audio playback and final caption/history. */
export async function readStreamingResponse(response: Response, signal: AbortSignal) {
  if(!response.body)throw new Error("Üres válaszfolyam.");
  const reader=response.body.getReader(),decoder=new TextDecoder();
  let resolveFirst!:(dialogue:Dialogue)=>void,rejectFirst!:(error:unknown)=>void;
  let resolveDone!:(dialogue:Dialogue)=>void,rejectDone!:(error:unknown)=>void;
  const first=new Promise<Dialogue>((resolve,reject)=>{resolveFirst=resolve;rejectFirst=reject;});
  const completed=new Promise<Dialogue>((resolve,reject)=>{resolveDone=resolve;rejectDone=reject;});
  void completed.catch(()=>{});
  let audio!:ReadableStreamDefaultController<Uint8Array>,closed=false,bytes=0;
  const audioBody=new ReadableStream<Uint8Array>({start(c){audio=c;},cancel(){closed=true;void reader.cancel().catch(()=>{});}});
  const abort=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener("abort",abort,{once:true});
  void(async()=>{
    let pending="",final:Dialogue|undefined;
    try{
      while(true){
        signal.throwIfAborted();
        const chunk=await reader.read();pending+=decoder.decode(chunk.value,{stream:!chunk.done});
        if(pending.length>1_000_000)throw new Error("Túl hosszú válaszfolyam.");
        let end:number;
        while((end=pending.indexOf("\n"))>=0){
          const line=pending.slice(0,end);pending=pending.slice(end+1);if(!line.trim())continue;
          const value=JSON.parse(line);
          if(final)throw new Error("Hibás válaszfolyam.");
          if(value.type==="error")await readAIResponse(new Response(JSON.stringify(value),{status:502}));
          else if(value.type==="turn")resolveFirst(dialogueSchema.parse({turns:[value.turn]}));
          else if(value.type==="audio"){
            const raw=atob(value.audio);bytes+=raw.length;
            if(bytes>8_000_000)throw new Error("Túl hosszú hangfolyam.");
            if(!closed)audio.enqueue(Uint8Array.from(raw,c=>c.charCodeAt(0)));
          }else if(value.type==="done"){final=dialogueSchema.parse(value.dialogue);resolveFirst(final);}
          else if(value.type!=="ready")throw new Error("Hibás válaszfolyam.");
        }
        if(chunk.done)break;
      }
      signal.throwIfAborted();
      if(!final||!bytes||pending.trim())throw new Error("Megszakadt a válaszfolyam.");
      if(!closed){closed=true;audio.close();}resolveDone(final);
    }catch(error){rejectFirst(error);rejectDone(error);if(!closed){closed=true;audio.error(error);}}
    finally{signal.removeEventListener("abort",abort);await reader.cancel().catch(()=>{});}
  })();
  const dialogue=await first;
  const format=response.headers.get("X-Live-Audio-Format");
  return {dialogue,audio:new Response(audioBody,{headers:{"Content-Type":audioContentType(format==="pcm"?"pcm":"mp3")}}),completed};
}
