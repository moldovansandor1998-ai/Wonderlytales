import { z } from "zod";
export const ShotStatus=z.enum(["DRAFT","SCRIPTED","READY_FOR_AUDIO","AUDIO_READY","READY_FOR_PREVIEW","PREVIEW_RENDERING","PREVIEW_READY","QC_RUNNING","QC_WARNING","QC_FAILED","APPROVED_FOR_FINAL","FINAL_RENDERING","FINAL_READY","LOCKED","CANCELLED"]);
const Vec3=z.tuple([z.number(),z.number(),z.number()]);
export const ShotSchema=z.object({
 schema_version:z.literal("1.0"),shot_id:z.string().min(1),episode_id:z.string().min(1),scene_id:z.string().min(1),shot_number:z.number().int().positive(),status:ShotStatus,duration_sec:z.number().positive(),
 location:z.object({asset_id:z.string(),version:z.number().int().positive(),variant:z.string().optional()}),
 characters:z.array(z.object({asset_id:z.string(),version:z.number().int().positive(),costume_id:z.string().nullable().optional(),position:Vec3,rotation:Vec3,animation:z.string(),emotion:z.string(),look_at:z.string().nullable().optional()})),
 props:z.array(z.object({asset_id:z.string(),version:z.number().int().positive(),state:z.string().optional(),position:Vec3})).default([]),
 dialogue:z.array(z.object({line_id:z.string(),character_id:z.string(),text:z.string(),voice_asset_id:z.string().nullable().optional(),emotion:z.string(),start_sec:z.number().nonnegative()})).default([]),
 camera:z.object({shot_type:z.string(),lens_mm:z.number().positive(),target:z.string().optional(),movement:z.string()}),
 lighting:z.object({preset:z.string(),time_of_day:z.string()}),
 render:z.object({preview_engine:z.string(),final_engine:z.string(),width:z.number().int().positive().default(1920),height:z.number().int().positive().default(1080),fps:z.number().int().positive().default(24),priority:z.number().int().default(50)}),
 qc:z.object({profile:z.string(),minimum_score:z.number().min(0).max(1),required_checks:z.array(z.string())})
});
export type ShotDocument=z.infer<typeof ShotSchema>;
