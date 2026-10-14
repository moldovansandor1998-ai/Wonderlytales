import { generateStreamingDialogue } from "./dialogue-stream";
import { replySpeaker, type CastVoices, type DialogueInput } from "./duo";
import { openSpeechSocket } from "./speech-socket";
import type { LiveAudioFormat } from "./audio-format";

export function streamedResponse(input: DialogueInput & {voices:CastVoices}, requestSignal: AbortSignal, format: LiveAudioFormat = "mp3") {
  const stopped=new AbortController();
  const signal=AbortSignal.any([requestSignal,stopped.signal,AbortSignal.timeout(45000)]);
  const encoder=new TextEncoder(),startedAt=Date.now();
  let closed=false;
  const body=new ReadableStream<Uint8Array>({
    start(controller) {
      const send=(value:unknown)=>{if(!closed)controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));};
      send({type:"ready"});
      void (async()=>{
        let firstAudioMs:number|undefined,firstSentenceMs:number|undefined;
        try{
          const speech=openSpeechSocket(input.voices[replySpeaker(input)],signal,audio=>{
            if(firstAudioMs===undefined)firstAudioMs=Date.now()-startedAt;
            send({type:"audio",audio});
          },format);
          // Observe an early socket failure immediately while the model is still preparing.
          void speech.catch(error=>stopped.abort(error));
          const generation=generateStreamingDialogue(input,signal,async(turn,addition)=>{
            const socket=await speech;
            signal.throwIfAborted();
            if(firstSentenceMs===undefined)firstSentenceMs=Date.now()-startedAt;
            send({type:"turn",turn});socket.send(addition);
          });
          const [dialogue,socket]=await Promise.all([generation,speech]);
          await socket.finish();signal.throwIfAborted();
          send({type:"done",dialogue});
          console.info("live_response_stream",{format,firstSentenceMs,firstAudioMs,durationMs:Date.now()-startedAt});
        }catch(error){
          const code=error instanceof Error&&/^(AI_[A-Z_]+|VOICE_[A-Z_]+|ELEVENLABS_NOT_CONFIGURED)$/.test(error.message)?error.message:"VIDEO_SERVICE_UNAVAILABLE";
          if(!requestSignal.aborted)send({type:"error",error:code});
        }finally{
          stopped.abort();
          if(!closed){closed=true;controller.close();}
        }
      })();
    },
    cancel(){closed=true;stopped.abort();},
  });
  return new Response(body,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","X-Live-Audio-Format":format,"Cache-Control":"private, no-store, no-transform","X-Content-Type-Options":"nosniff"}});
}
