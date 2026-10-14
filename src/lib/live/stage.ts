import type { Emotion } from "./events";
import type { GiftEffect, Speaker } from "./duo";
export type StageState = { name: string; image: string; caption: string; speaking: boolean; emotion: Emotion; connected: boolean; song: string; scene?: "solo" | "duo"; speaker?: Speaker; motion?: {id:string;url:string;position:number;playing:boolean}; effect?: GiftEffect; backdrop?: {url:string;active:boolean}; npc?: {frame?: {id:string;url:string;position:number;playing:boolean};active:boolean}; showStatus?: string };
export const initialStage: StageState = { name: "Mc Isti", image: "/live-studio/pirate.png", caption: "Kezdődhet a műsor!", speaking: false, emotion: "neutral", connected: false, song: "" };
