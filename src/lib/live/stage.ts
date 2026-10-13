import type { Emotion } from "./events";
export type StageState = { name: string; image: string; caption: string; speaking: boolean; emotion: Emotion; connected: boolean; song: string };
export const initialStage: StageState = { name: "Kalóz kapitány", image: "/live-studio/pirate.png", caption: "Üdv a fedélzeten!", speaking: false, emotion: "neutral", connected: false, song: "" };
