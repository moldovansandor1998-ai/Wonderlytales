import type { ShotData, ShotStatusT } from "./schemas/shot";

export type CharacterType = "CORE" | "RECURRING" | "GUEST";
export type JobStatus = "QUEUED"|"CLAIMED"|"RUNNING"|"SUCCEEDED"|"FAILED"|"RETRY_WAIT"|"CANCELLED";
export type QcStatus = "PENDING"|"PASS"|"WARNING"|"FAIL";
export type LocStatus = "MISSING"|"TRANSLATION_PENDING"|"TRANSLATING"|"TEXT_READY"|"TTS_PENDING"|"TTS_READY"|"LIPSYNC_PENDING"|"GENERATING"|"READY"|"FAILED";

export interface Project { id: string; name: string; code: string; created_at: string; }
export interface Series { id: string; project_id: string; name: string; international_name: string; bible: string; age_range: string; fps: number; resolution: string; visual_style: string; status: string; }
export interface Season { id: string; series_id: string; number: number; title: string; arc: string; status: string; }
export interface Episode { id: string; season_id: string; number: number; title: string; brief: string; target_duration_sec: number; master_language: string; script_version: string; status: string; estimated_cost: number; actual_cost: number; }
export interface Scene { id: string; episode_id: string; number: number; title: string; location_id: string | null; summary: string; }
export interface ShotRow { id: string; scene_id: string; shot_number: number; status: ShotStatusT; revision: number; data: ShotData; }
export interface Character { id: string; code: string; name: string; type: CharacterType; species: string; gender: string | null; age_description: string; personality: string; visual_description: string; speech_style: string; status: string; thumbnail: string | null; }
export interface CharacterVersion { id: string; character_id: string; version: string; asset_id: string; master_model_path: string | null; rig_profile: string; facial_profile: string; viseme_profile: string; hair_fur_meta: Record<string, unknown>; scale: number; costumes: string[]; expressions: string[]; retarget_profile: string; status: "DRAFT"|"LOCKED"; locked_at: string | null; }
export interface Voice { id: string; character_id: string; language: string; provider: string; voice_id: string; model: string; stability: number; style: number; }
export interface Location { id: string; code: string; name: string; description: string; variants: string[]; status: string; }
export interface LocationVersion { id: string; location_id: string; version: string; asset_id: string; blender_asset_path: string | null; fixed_layout: boolean; status: "DRAFT"|"LOCKED"; locked_at: string | null; }
export interface Prop { id: string; code: string; name: string; description: string; allowed_states: string[]; status: string; }
export interface PropVersion { id: string; prop_id: string; version: string; asset_id: string; asset_path: string | null; status: "DRAFT"|"LOCKED"; locked_at: string | null; }
export interface Animation { id: string; code: string; name: string; category: string; skeleton_profile: string; source_asset: string | null; duration_sec: number; loopable: boolean; tags: string[]; compatibility: string[]; }
export interface DialogueLine { id: string; scene_id: string; shot_id: string | null; character_id: string; sequence: number; text: string; language: string; emotion: string; audio_path: string | null; }
export interface LocalizedLine { id: string; dialogue_line_id: string; language: string; text: string; audio_path: string | null; status: LocStatus; }
export interface Asset { id: string; asset_code: string; version: string; kind: string; path: string; mime?: string; size?: number; sha256?: string; metadata: Record<string, unknown>; }
export interface ContinuityState { id: string; scene_id: string; shot_id: string | null; kind: "INPUT"|"OUTPUT"; state: ContinuityStateData; }
export interface ContinuityCharacterState { character_id: string; present: boolean; position?: [number,number,number]; rotation?: [number,number,number]; costume_id?: string | null; emotion?: string; held_object?: string | null; }
export interface ContinuityStateData {
  characters: ContinuityCharacterState[];
  props: { prop_id: string; state: string }[];
  environment: { time_of_day: string; weather: string; lighting_preset: string; location_id: string };
  story_variables: Record<string, string | number | boolean>;
}
export interface RenderJob { id: string; shot_id: string; type: "PREVIEW"|"FINAL"|"AUDIO"|"FACIAL"|"VFX"|"ASSEMBLY"; status: JobStatus; worker: string; provider: string; attempt: number; max_attempts: number; input_snapshot: Record<string, unknown>; output_path: string | null; gpu_seconds: number; cost_usd: number; error: string | null; created_at: string; updated_at: string; }
export interface QcResult { id: string; shot_id: string; job_id: string | null; check: string; status: QcStatus; score: number; details: string; created_at: string; }
export interface CostEvent { id: string; project_id: string | null; series_id: string | null; episode_id: string | null; shot_id: string | null; job_id?: string | null; language?: string | null; retry?: boolean; category: "GPU"|"TTS"|"STORAGE"|"GENVIDEO"|"TRANSLATION"|"LLM"|"RETRY"; provider: string; service?: string; amount_usd: number; quantity: number; unit: string; unit_price_usd?: number; currency?: string; created_at: string; }
export interface TranslationJob { id: string; episode_id: string; language: string; status: LocStatus; provider: string; cost_usd: number; }
export interface EpisodeLocalization { id: string; episode_id: string; language: string; status: LocStatus; audio_master_path: string | null; subtitle_path: string | null; }
