import { z } from "zod";

/** SHOT_SCHEMA_V1 – kötelező runtime validáció minden shotra */
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const ShotStatus = z.enum([
  "DRAFT","SCRIPTED","READY_FOR_AUDIO","AUDIO_READY","READY_FOR_PREVIEW",
  "PREVIEW_RENDERING","PREVIEW_READY","QC_RUNNING","QC_WARNING","QC_FAILED",
  "APPROVED_FOR_FINAL","FINAL_RENDERING","FINAL_READY","LOCKED","CANCELLED",
]);
export type ShotStatusT = z.infer<typeof ShotStatus>;

export const ShotCharacter = z.object({
  character_id: z.string().uuid(),
  asset_id: z.string().min(1),          // pl. CHAR_MARK
  asset_version: z.string().regex(/^V\d{3}$/), // pl. V001
  costume_id: z.string().nullable().default(null),
  position: Vec3,
  rotation: Vec3,
  animation_code: z.string().nullable().default(null),
  emotion: z.enum(["neutral","happy","sad","angry","fear","surprise","excited","curious"]).default("neutral"),
  look_at: z.string().nullable().default(null),
});
export const ShotProp = z.object({
  prop_id: z.string().uuid(),
  asset_id: z.string(),
  asset_version: z.string(),
  state: z.string().default("DEFAULT"),
  position: Vec3.optional(),
});
export const ShotDialogue = z.object({
  dialogue_line_id: z.string().uuid(),
  character_id: z.string().uuid(),
  text: z.string(),
  language: z.string().default("hu"),
});
export const ShotCamera = z.object({
  shot_type: z.enum(["EXTREME_WIDE","WIDE","MEDIUM_WIDE","MEDIUM","MEDIUM_CLOSE","CLOSE_UP","EXTREME_CLOSE_UP","OVER_SHOULDER","POV","AERIAL"]),
  lens_mm: z.number().min(8).max(200).default(35),
  target: z.string().nullable().default(null),
  movement: z.enum(["STATIC","PAN","TILT","DOLLY_IN","DOLLY_OUT","TRUCK","CRANE","HANDHELD","ORBIT"]).default("STATIC"),
  preset: z.string().nullable().default(null),
});
export const ShotLighting = z.object({
  preset: z.enum(["DAY","NIGHT","SUNSET","RAIN","WINTER","INTERIOR","MAGICAL"]).default("DAY"),
  time_of_day: z.string().default("12:00"),
});
export const ShotRender = z.object({
  visual_style: z.enum(["TECHNICAL_PROXY", "STORYBOOK_DRAFT_V002"]).optional(),
  engine: z.enum(["BLENDER_EEVEE","BLENDER_CYCLES","MOCK"]).default("BLENDER_EEVEE"),
  width: z.number().int().default(1920),
  height: z.number().int().default(1080),
  fps: z.number().int().default(24),
  quality: z.enum(["PREVIEW","FINAL"]).default("PREVIEW"),
  priority: z.number().int().min(0).max(100).default(50),
});
export const ShotQc = z.object({
  profile: z.string().default("DEFAULT"),
  minimum_score: z.number().min(0).max(100).default(70),
  required_checks: z.array(z.string()).default(["ASSET_VERSION","CHARACTER","CAMERA","RENDER_CORRUPTION"]),
});
export const ShotSchemaV1 = z.object({
  schema_version: z.literal("SHOT_SCHEMA_V1"),
  shot_id: z.string().uuid(),
  episode_id: z.string().uuid(),
  scene_id: z.string().uuid(),
  shot_number: z.number().int().positive(),
  revision: z.number().int().positive().default(1),
  status: ShotStatus.default("DRAFT"),
  duration_sec: z.number().positive().max(120),
  location: z.object({
    location_id: z.string().uuid(),
    asset_id: z.string(),
    asset_version: z.string(),
    variant: z.string().default("DAY"),
  }),
  characters: z.array(ShotCharacter).default([]),
  props: z.array(ShotProp).default([]),
  dialogue: z.array(ShotDialogue).default([]),
  camera: ShotCamera,
  lighting: ShotLighting.default({ preset: "DAY", time_of_day: "12:00" }),
  animation: z.object({ notes: z.string().default("") }).default({ notes: "" }),
  audio: z.object({
    dialogue_track: z.string().nullable().default(null),
    sfx: z.array(z.string()).default([]),
    music_cue: z.string().nullable().default(null),
    ambience: z.string().nullable().default(null),
  }).default({}),
  vfx: z.object({
    mode: z.enum(["BLENDER","BLENDER_PLUS_VFX","GENERATIVE_VIDEO","COMPOSITE"]).default("BLENDER"),
    provider: z.string().nullable().default(null),
    reference_frames: z.array(z.string()).default([]),
    max_cost_usd: z.number().default(0),
  }).default({}),
  continuity: z.object({
    input_state_id: z.string().uuid().nullable().default(null),
    output_state_id: z.string().uuid().nullable().default(null),
  }).default({}),
  render: ShotRender.default({ engine: "BLENDER_EEVEE", width: 1920, height: 1080, fps: 24, quality: "PREVIEW", priority: 50 }),
  qc: ShotQc.default({ profile: "DEFAULT", minimum_score: 70, required_checks: ["ASSET_VERSION","CHARACTER","CAMERA","RENDER_CORRUPTION"] }),
  cost: z.object({ estimated_usd: z.number().default(0), actual_usd: z.number().default(0) }).default({}),
});
export type ShotData = z.infer<typeof ShotSchemaV1>;
export function validateShot(input: unknown): ShotData {
  return ShotSchemaV1.parse(input);
}
