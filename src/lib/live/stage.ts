import type { Emotion } from "./events";
import type { GiftEffect, Speaker } from "./duo";
export type StageState = { name: string; image: string; caption: string; speaking: boolean; emotion: Emotion; connected: boolean; song: string; scene?: "solo" | "duo"; speaker?: Speaker; effect?: GiftEffect };
export const initialStage: StageState = { name: "Kalóz kapitány", image: "/live-studio/pirate.png", caption: "Üdv a fedélzeten!", speaking: false, emotion: "neutral", connected: false, song: "" };
