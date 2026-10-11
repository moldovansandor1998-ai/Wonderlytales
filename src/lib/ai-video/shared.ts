/** Shared display contract. No credentials, network calls or storage imports. */
export const WAVESPEED_MODEL = 'kwaivgi/kling-v3.0-pro/image-to-video';
export const WAVESPEED_SERVICE = 'wavespeed_kling';
export const WAVESPEED_CEILING_USD = 1.68; // Max 10s + sound, official price checked 2026-10-11.
// Fixed server-side rule, appended after scene instructions for every prompt-capable video model.
export const VIDEO_NO_TEXT_RULE = 'MANDATORY VISUAL RULE FOR THE ENTIRE VIDEO: Generate clean animation only. Do not add any subtitles, captions, closed captions, karaoke text, dialogue text, speech bubbles, titles, credits, labels, logos, watermarks, letters, numbers, random symbols, or illegible pseudo-writing. Never transcribe, translate, or display the spoken audio on screen. Audio is heard only; speech is expressed through the character\'s mouth and facial animation only. Keep every frame free of newly generated text and graphic overlays, from the first frame to the last. Preserve the reference artwork and background without adding writing.';
export const NEGATIVE_PROMPT = 'Different character, changed face or fur color, changed clothes, missing backpack, extra limbs, fused fingers, deformed body, sliding feet, flicker, random zoom, random cuts, subtitles, captions, closed captions, karaoke text, dialogue text, speech bubbles, titles, credits, labels, logos, watermarks, letters, numbers, random symbols, illegible pseudo-writing, typography, text overlays.';
export type VideoStatus = 'SUBMITTING' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'BLOCKED_BUDGET' | 'SUBMISSION_UNCERTAIN';
export type VideoElement = {elementId:string;name:string;referenceSha256:string};
export interface VideoInput {
  id: string; imageSha256: string; endImageSha256?: string; elements?:VideoElement[];
  prompt: string; duration: 5 | 10; sound: boolean; maxCostUsd: number;
}
export interface VideoJob extends VideoInput {
  requestHash: string; model: string; status: VideoStatus; createdAt: string;
  estimatedCostUsd: number; taskId?: string; outputUrl?: string; error?: string;
  mediaVerified: false; productionApproved: false;
  archived?:boolean;
  continuityNote?:string;
  transcript?: { status: "SUBMITTING" | "PROCESSING" | "COMPLETED" | "FAILED" | "UNCERTAIN"; taskId?: string; text?: string; estimatedCostUsd: number };
}
export const TERMINAL_STATUSES: VideoStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED_BUDGET', 'SUBMISSION_UNCERTAIN'];
export const FELIX_SCENES = [
  { title: '1. Séta és fékezés', prompt: 'One continuous cinematic 3D animated shot in Titokváros, using this exact reference image as the first frame. Keep Félix the SAME red fox: identical face, green eyes, detailed red and cream fur, proportions, turquoise jacket, white T-shirt, dark trousers and backpack. Preserve the city architecture, tram, vehicles and animal residents. Félix walks naturally toward camera; camera gently tracks backward at constant distance. Background animals walk and tram and cars move plausibly. He looks around and smiles. In the final two seconds a sudden loud brake squeal is heard off screen right; his ears twitch, eyes widen and he quickly turns his head toward the sound. Natural weight, grounded footsteps, fur motion, warm cinematic light, live city ambience. One shot, no cuts or zoom. Audio: city, footsteps, sudden brakes, subtle suspense music. No speech.' },
  { title: '2. Félreugrás és futás', prompt: 'Continue immediately from this exact last frame, one continuous cinematic 3D animated shot in the same Titokváros street. Preserve Félix’s exact identity, red and cream fur, face, green eyes, turquoise jacket, white T-shirt, dark trousers and backpack. A vehicle brakes abruptly at the intersection. Félix startles, plants his feet, leaps sideways onto the safe part of the pavement, lands with believable weight, then runs. Camera follows dynamically and smoothly at a stable distance. No collision or injury. Keep city geometry and background animals consistent. Detailed fur, physical momentum, cloth and backpack motion. Audio: tire squeal, brakes, quick footfalls, traffic and exciting orchestral suspense music. No speech, no random cut or zoom.' },
  { title: '3. Megkönnyebbülés magyarul', prompt: 'Continue immediately from this exact last frame, one continuous cinematic 3D animated shot in the same Titokváros street. Keep Félix exactly identical: same red fox face, green eyes, fur, proportions, turquoise jacket, white T-shirt, dark trousers and backpack. Félix slows to a stop, glances back, breathes out with relief, then looks toward camera, relieved and curious, keeping his mouth relaxed and closed. Leave space for his separately recorded ElevenLabs character dialogue. No generated speech. Camera settles smoothly to a steady medium shot. Believable recovery from running, subtle ear and tail movement, cinematic light. Audio: breathing, receding traffic and gentle resolution of the suspense score. No subtitles, no extra dialogue, no random camera switch.' },
] as const;
export function documentedPrice(duration: 5 | 10, sound: boolean) {
  return Math.round(duration * (sound ? 168 : 112)) / 1000;
}
export const STATUS_LABELS: Record<VideoStatus, string> = {
  SUBMITTING: 'Beküldés folyamatban', QUEUED: 'Sorban áll', RUNNING: 'Videó készül', COMPLETED: 'Elkészült · ellenőrzésre vár',
  FAILED: 'A generálás sikertelen', CANCELLED: 'Leállítva', BLOCKED_BUDGET: 'A költségkeret megállította',
  SUBMISSION_UNCERTAIN: 'A beküldés eredménye bizonytalan · nincs automatikus újraküldés',
};
