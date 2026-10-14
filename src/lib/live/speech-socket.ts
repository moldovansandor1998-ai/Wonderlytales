import WebSocket from "ws";
import { reserveProductionBudget } from "@/lib/budget";

/** One authenticated, bounded TTS session per reply. Text and audio flow concurrently. */
export async function openSpeechSocket(voiceId: string, signal: AbortSignal, onAudio: (base64: string) => void) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_NOT_CONFIGURED");
  signal.throwIfAborted();
  await reserveProductionBudget("tts");
  signal.throwIfAborted();
  const socket = new WebSocket(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_flash_v2_5&language_code=hu&output_format=mp3_44100_64&auto_mode=true`, {
    headers:{"xi-api-key":key}, handshakeTimeout:10000, maxPayload:1_000_000,
  });
  let resolveOpen!: () => void, rejectOpen!: (error: Error) => void;
  let resolveDone!: () => void, rejectDone!: (error: Error) => void;
  const opened = new Promise<void>((resolve,reject) => {resolveOpen=resolve;rejectOpen=reject;});
  const done = new Promise<void>((resolve,reject) => {resolveDone=resolve;rejectDone=reject;});
  void done.catch(() => {});
  let settled=false, ending=false, characters=0, bytes=0;
  const cleanup = () => {clearTimeout(timer);signal.removeEventListener("abort",abort);};
  const fail = (error = new Error("VOICE_PROVIDER_ERROR")) => {
    if (settled) return; settled=true;cleanup();rejectOpen(error);rejectDone(error);socket.terminate();
  };
  const abort = () => fail(signal.reason instanceof Error ? signal.reason : new DOMException("Stopped","AbortError"));
  const timer = setTimeout(() => fail(), 45000);
  signal.addEventListener("abort",abort,{once:true});
  socket.on("error", () => fail());
  socket.on("unexpected-response", (_request,response) => {response.resume();fail(new Error(response.statusCode===429?"VOICE_RATE_LIMIT":"VOICE_PROVIDER_ERROR"));});
  socket.on("close", () => {if(!settled)fail();});
  socket.on("open", () => {
    if (signal.aborted) {abort();return;}
    socket.send(JSON.stringify({text:" ",voice_settings:{stability:0.4,similarity_boost:0.75,use_speaker_boost:false}}));
    resolveOpen();
  });
  socket.on("message", raw => {
    if (settled) return;
    try {
      const data=JSON.parse(raw.toString());
      if(data.error)throw new Error("VOICE_PROVIDER_ERROR");
      if(data.audio){
        if(typeof data.audio!=="string"||!/^[A-Za-z0-9+/=]+$/.test(data.audio))throw new Error("VOICE_PROVIDER_ERROR");
        bytes+=Buffer.byteLength(data.audio,"base64");
        if(bytes>8_000_000)throw new Error("VOICE_PROVIDER_ERROR");
        onAudio(data.audio);
      }
      if(data.isFinal||data.is_final){
        if(!ending||!bytes)throw new Error("VOICE_PROVIDER_ERROR");
        settled=true;cleanup();resolveDone();socket.close();
      }
    }catch{fail();}
  });
  if(signal.aborted)abort();
  await opened;
  return {
    send(text: string) {
      signal.throwIfAborted();
      characters+=text.length;
      if(settled||ending||characters>1000||socket.readyState!==WebSocket.OPEN)throw new Error("VOICE_PROVIDER_ERROR");
      socket.send(JSON.stringify({text:`${text} `,flush:true}));
    },
    async finish() {
      signal.throwIfAborted();
      if(!settled){ending=true;socket.send(JSON.stringify({text:""}));}
      await done;
    },
  };
}
