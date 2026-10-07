import { requireConfiguration, rejectProductionMock } from "../config";
/** FacialAnimationProvider: audio + facial profile + emotion → viseme/blendshape timeline JSON */
export interface BlendshapeKey { t: number; shapes: Record<string, number>; }
export interface FacialTrack { format: "BLENDSHAPE_V1"; fps: number; durationSec: number; keys: BlendshapeKey[]; }
export interface FacialProvider {
  name: string;
  generate(input: { audioPath: string; audioDurationSec: number; text?: string; facialProfile: string; visemeProfile: string; emotion: string }): Promise<FacialTrack>;
}

const EMOTION_BASE: Record<string, Record<string, number>> = {
  neutral: {}, happy: { smile: 0.7 }, sad: { frown: 0.6 }, angry: { brow_down: 0.8 },
  fear: { eye_wide: 0.6, brow_up: 0.5 }, surprise: { eye_wide: 0.9, jaw_open: 0.3 },
  excited: { smile: 0.8, eye_wide: 0.4 }, curious: { brow_up: 0.4 },
};
const VISEMES = ["sil","aa","ee","oh","oo","mm","ff","th","rr","ss"];

/** LOCAL fallback: timing/szöveg alapú viseme track – külső szolgáltatás nélkül is valódi output */
export class LocalVisemeFacial implements FacialProvider {
  name = "local-viseme";
  async generate(input: { audioPath?: string; audioDurationSec: number; text?: string; facialProfile: string; visemeProfile?: string; emotion: string }): Promise<FacialTrack> {
    const fps = 24;
    const keys: BlendshapeKey[] = [];
    const base = EMOTION_BASE[input.emotion] ?? {};
    const syllables = Math.max(1, Math.round((input.text?.length ?? input.audioDurationSec * 12) / 3));
    const step = input.audioDurationSec / syllables;
    for (let i = 0; i <= syllables; i++) {
      const t = Math.min(input.audioDurationSec, i * step);
      const viseme = i === syllables ? "sil" : VISEMES[1 + (i * 7) % (VISEMES.length - 1)];
      keys.push({ t: Number(t.toFixed(3)), shapes: { ...base, [`viseme_${viseme}`]: 1, jaw_open: viseme === "sil" ? 0 : 0.4 } });
    }
    return { format: "BLENDSHAPE_V1", fps, durationSec: input.audioDurationSec, keys };
  }
}

export class MockFacial implements FacialProvider {
  name = "mock";
  async generate(input: { audioPath: string; audioDurationSec: number; facialProfile: string; emotion: string }): Promise<FacialTrack> {
    return new LocalVisemeFacial().generate(input); // mock = local fallback
  }
}

/** Audio2Face / ACE adapter skeleton – tényleges HTTP request/response, poll-al */
export class Audio2FaceProvider implements FacialProvider {
  name = "audio2face";
  constructor(private endpoint: string) {}
  async generate(input: { audioPath: string; audioDurationSec: number; facialProfile: string; emotion: string }): Promise<FacialTrack> {
    const { fetchWithTimeout } = await import("./translation");
    const submit = await fetchWithTimeout(`${this.endpoint}/audio2face/jobs`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: input.audioPath, facial_profile: input.facialProfile, emotion: input.emotion }),
    }, 30000);
    if (!submit.ok) throw new Error(`Audio2Face submit hiba: ${submit.status}`);
    const { job_id } = await submit.json() as { job_id: string };
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await fetchWithTimeout(`${this.endpoint}/audio2face/jobs/${job_id}`, {}, 15000);
      if (!st.ok) continue;
      const data = await st.json() as { status: string; track?: FacialTrack };
      if (data.status === "SUCCEEDED" && data.track) return data.track;
      if (data.status === "FAILED") throw new Error("Audio2Face job FAILED");
    }
    throw new Error("Audio2Face timeout");
  }
}

export function getFacialProvider(): FacialProvider {
  if (process.env.FACIAL_PROVIDER === "audio2face" && process.env.AUDIO2FACE_ENDPOINT) return new Audio2FaceProvider(process.env.AUDIO2FACE_ENDPOINT);
  if (process.env.FACIAL_PROVIDER === "local") return new LocalVisemeFacial();
  if (process.env.FACIAL_PROVIDER === "audio2face") requireConfiguration("Audio2Face", ["AUDIO2FACE_ENDPOINT"]);
  rejectProductionMock("Facial");
  return new MockFacial();
}
