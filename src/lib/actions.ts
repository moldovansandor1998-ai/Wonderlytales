"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, newId } from "./db";
import type { Character, Episode, Location, Prop, Animation, Voice, Scene, ShotRow, Season, Series, CharacterVersion, LocationVersion, PropVersion } from "./types";
import { validateShot, type ShotData, type ShotStatusT } from "./schemas/shot";
import { saveShotRevision, generatePreview, setShotStatus, finalRender, applyContinuity } from "./pipeline";
import { processNextJob } from "./queue";
import { localizeEpisode } from "./localization";
import { lockVersion, assertEditable, nextVersion } from "./assetVersioning";
import { getStoryEngine } from "./providers/story";

function s(fd: FormData, k: string, d = ""): string { return String(fd.get(k) ?? d); }

export async function createSeriesAction(fd: FormData) {
  const db = await getDb();
  const projects = await db.list<{ id: string }>("projects");
  await db.insert<Series>("series", { id: newId(), project_id: s(fd,"project_id") || projects[0].id, name: s(fd,"name"), international_name: s(fd,"international_name"), bible: s(fd,"bible"), age_range: s(fd,"age_range","4-9"), fps: Number(fd.get("fps") ?? 24), resolution: s(fd,"resolution","1920x1080"), visual_style: s(fd,"visual_style"), status: "ACTIVE" });
  revalidatePath("/series");
}
export async function createSeasonAction(fd: FormData) {
  const db = await getDb();
  await db.insert<Season>("seasons", { id: newId(), series_id: s(fd,"series_id"), number: Number(fd.get("number")), title: s(fd,"title"), arc: s(fd,"arc"), status: "PLANNED" });
  revalidatePath(`/series/${s(fd,"series_id")}`);
}
export async function createEpisodeAction(fd: FormData) {
  const db = await getDb();
  await db.insert<Episode>("episodes", { id: newId(), season_id: s(fd,"season_id"), number: Number(fd.get("number")), title: s(fd,"title"), brief: s(fd,"brief"), target_duration_sec: Number(fd.get("target_duration_sec") ?? 1200), master_language: s(fd,"master_language","hu"), script_version: "SCRIPT_V1", status: "DRAFT", estimated_cost: 0, actual_cost: 0 });
  revalidatePath(`/series/${s(fd,"series_id")}`);
}
export async function generateStoryAction(episodeId: string) {
  const db = await getDb();
  const ep = await db.get<Episode>("episodes", episodeId);
  if (!ep) throw new Error("Epizód nem található");
  const season = await db.get<Season>("seasons", ep.season_id);
  const series = season ? await db.get<Series>("series", season.series_id) : null;
  const engine = getStoryEngine();
  return engine.generateEpisode({ bible: series?.bible ?? "", seasonContext: season?.arc ?? "", previousSummaries: [], brief: ep.brief, ageRange: series?.age_range ?? "4-9", durationSec: ep.target_duration_sec, language: ep.master_language });
}
export async function createSceneAction(fd: FormData) {
  const db = await getDb();
  const episodeId = s(fd,"episode_id");
  await db.insert<Scene>("scenes", { id: newId(), episode_id: episodeId, number: Number(fd.get("number")), title: s(fd,"title"), location_id: s(fd,"location_id") || null, summary: s(fd,"summary") });
  revalidatePath(`/episodes/${episodeId}`);
}
export async function createShotAction(fd: FormData) {
  const db = await getDb();
  const sceneId = s(fd,"scene_id");
  const scene = await db.get<Scene>("scenes", sceneId);
  if (!scene) throw new Error("Jelenet nem található");
  const locId = s(fd,"location_id") || scene.location_id;
  const loc = locId ? await db.get<Location>("locations", locId) : null;
  const locV = loc ? (await db.find<LocationVersion>("location_versions", (v) => v.location_id === loc.id))[0] : null;
  const id = newId();
  const existing = await db.find<ShotRow>("shots", (x) => x.scene_id === sceneId);
  const n = existing.length ? Math.max(...existing.map((x) => x.shot_number)) + 1 : 1;
  const data = validateShot({
    schema_version: "SHOT_SCHEMA_V1", shot_id: id, episode_id: scene.episode_id, scene_id: sceneId,
    shot_number: n, duration_sec: Number(fd.get("duration_sec") ?? 5),
    location: { location_id: locId, asset_id: locV?.asset_id ?? "UNKNOWN", asset_version: locV?.version ?? "V001", variant: "DAY" },
    characters: [], props: [], dialogue: [],
    camera: { shot_type: "MEDIUM", lens_mm: 35, target: null, movement: "STATIC", preset: null },
  });
  await db.insert<ShotRow>("shots", { id, scene_id: sceneId, shot_number: n, status: "DRAFT", revision: 1, data });
  revalidatePath(`/episodes/${scene.episode_id}`);
}
export async function createCharacterAction(fd: FormData) {
  const db = await getDb();
  const c = await db.insert<Character>("characters", { id: newId(), code: s(fd,"code"), name: s(fd,"name"), type: (s(fd,"type","CORE") as Character["type"]), species: s(fd,"species"), gender: s(fd,"gender") || null, age_description: s(fd,"age_description"), personality: s(fd,"personality"), visual_description: s(fd,"visual_description"), speech_style: s(fd,"speech_style"), status: "ACTIVE", thumbnail: null });
  await db.insert<CharacterVersion>("character_versions", { id: newId(), character_id: c.id, version: "V001", asset_id: `${c.code}_V001`, master_model_path: null, rig_profile: "STANDARD_BIPED_V1", facial_profile: "FACE_PROFILE_V1", viseme_profile: "VISEME_15_V1", hair_fur_meta: {}, scale: 1, costumes: ["default"], expressions: ["neutral","happy","sad"], retarget_profile: "RETARGET_V1", status: "DRAFT", locked_at: null });
  revalidatePath("/characters");
}
export async function updateCharacterAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Character>("characters", id, { name: s(fd,"name"), personality: s(fd,"personality"), visual_description: s(fd,"visual_description"), speech_style: s(fd,"speech_style"), status: s(fd,"status","ACTIVE") });
  revalidatePath(`/characters/${id}`);
}
export async function newCharacterVersionAction(characterId: string) {
  const db = await getDb();
  const versions = await db.find<CharacterVersion>("character_versions", (v) => v.character_id === characterId);
  const latest = versions.sort((a, b) => b.version.localeCompare(a.version))[0];
  const v = nextVersion(latest?.version ?? "V000");
  await db.insert<CharacterVersion>("character_versions", { ...(latest ?? {}), id: newId(), character_id: characterId, version: v, asset_id: `${(await db.get<Character>("characters", characterId))!.code}_${v}`, status: "DRAFT", locked_at: null } as CharacterVersion);
  revalidatePath(`/characters/${characterId}`);
}
export async function lockVersionAction(table: string, id: string, backPath: string) {
  const db = await getDb();
  await lockVersion(db, table, id);
  revalidatePath(backPath);
}
export async function createLocationAction(fd: FormData) {
  const db = await getDb();
  const loc = await db.insert<Location>("locations", { id: newId(), code: s(fd,"code"), name: s(fd,"name"), description: s(fd,"description"), variants: s(fd,"variants","DAY").split(",").map((x) => x.trim()).filter(Boolean), status: "ACTIVE" });
  await db.insert<LocationVersion>("location_versions", { id: newId(), location_id: loc.id, version: "V001", asset_id: `${loc.code}_V001`, blender_asset_path: null, fixed_layout: true, status: "DRAFT", locked_at: null });
  revalidatePath("/locations");
}
export async function createPropAction(fd: FormData) {
  const db = await getDb();
  const p = await db.insert<Prop>("props", { id: newId(), code: s(fd,"code"), name: s(fd,"name"), description: s(fd,"description"), allowed_states: s(fd,"allowed_states","DEFAULT").split(",").map((x) => x.trim()).filter(Boolean), status: "ACTIVE" });
  await db.insert<PropVersion>("prop_versions", { id: newId(), prop_id: p.id, version: "V001", asset_id: `${p.code}_V001`, asset_path: null, status: "DRAFT", locked_at: null });
  revalidatePath("/props");
}
export async function createAnimationAction(fd: FormData) {
  const db = await getDb();
  await db.insert<Animation>("animations", { id: newId(), code: s(fd,"code"), name: s(fd,"name"), category: s(fd,"category","idle"), skeleton_profile: s(fd,"skeleton_profile","STANDARD_BIPED_V1"), source_asset: null, duration_sec: Number(fd.get("duration_sec") ?? 1), loopable: fd.get("loopable") === "on", tags: s(fd,"tags").split(",").map((x)=>x.trim()).filter(Boolean), compatibility: s(fd,"compatibility").split(",").map((x)=>x.trim()).filter(Boolean) });
  revalidatePath("/animations");
}
export async function createVoiceAction(fd: FormData) {
  const db = await getDb();
  await db.insert<Voice>("voices", { id: newId(), character_id: s(fd,"character_id"), language: s(fd,"language","hu"), provider: s(fd,"provider","mock"), voice_id: s(fd,"voice_id"), model: s(fd,"model"), stability: Number(fd.get("stability") ?? 0.5), style: Number(fd.get("style") ?? 0) });
  revalidatePath("/voices");
}
export async function deleteRowAction(table: string, id: string, backPath: string) {
  const db = await getDb();
  if (table.endsWith("_versions")) await assertEditable(db, table, id); // LOCKED → hiba
  await db.remove(table, id);
  revalidatePath(backPath);
}

// --- Shot workflow ---
export async function saveShotAction(shotId: string, data: ShotData) {
  const db = await getDb();
  await saveShotRevision(db, shotId, data);
  const shot = await db.get<ShotRow>("shots", shotId);
  if (shot) await applyContinuity(db, shot);
  revalidatePath(`/shots/${shotId}`);
}
export async function previewShotAction(shotId: string) {
  const db = await getDb();
  await generatePreview(db, shotId);
  revalidatePath(`/shots/${shotId}`);
}
export async function approveShotAction(shotId: string) { const db = await getDb(); await setShotStatus(db, shotId, "APPROVED_FOR_FINAL"); revalidatePath(`/shots/${shotId}`); }
export async function rejectShotAction(shotId: string) { const db = await getDb(); await setShotStatus(db, shotId, "DRAFT"); revalidatePath(`/shots/${shotId}`); }
export async function finalRenderAction(shotId: string) { const db = await getDb(); await finalRender(db, shotId); revalidatePath(`/shots/${shotId}`); }
export async function lockShotAction(shotId: string) { const db = await getDb(); await setShotStatus(db, shotId, "LOCKED" as ShotStatusT); revalidatePath(`/shots/${shotId}`); }
export async function processQueueAction() { const db = await getDb(); await processNextJob(db); revalidatePath("/render-queue"); }
export async function localizeAction(episodeId: string, lang: string) {
  const db = await getDb();
  await localizeEpisode(db, episodeId, lang);
  revalidatePath("/localization");
}

// --- CRUD kiegészítések ---
export async function updateSeriesAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Series>("series", id, { name: s(fd,"name"), international_name: s(fd,"international_name"), bible: s(fd,"bible"), age_range: s(fd,"age_range"), fps: Number(fd.get("fps") ?? 24), resolution: s(fd,"resolution"), visual_style: s(fd,"visual_style"), status: s(fd,"status","ACTIVE") });
  revalidatePath(`/series/${id}`); revalidatePath("/series");
}
export async function archiveSeriesAction(id: string) {
  const db = await getDb();
  await db.update<Series>("series", id, { status: "ARCHIVED" });
  revalidatePath("/series"); revalidatePath(`/series/${id}`);
}
export async function updateSeasonAction(id: string, seriesId: string, fd: FormData) {
  const db = await getDb();
  await db.update<Season>("seasons", id, { number: Number(fd.get("number")), title: s(fd,"title"), arc: s(fd,"arc"), status: s(fd,"status","PLANNED") });
  revalidatePath(`/series/${seriesId}`);
}
export async function updateEpisodeAction(id: string, seriesId: string, fd: FormData) {
  const db = await getDb();
  await db.update<Episode>("episodes", id, { number: Number(fd.get("number")), title: s(fd,"title"), brief: s(fd,"brief"), target_duration_sec: Number(fd.get("target_duration_sec") ?? 1200), master_language: s(fd,"master_language","hu"), script_version: s(fd,"script_version","SCRIPT_V1"), status: s(fd,"status","DRAFT") });
  revalidatePath(`/episodes/${id}`); revalidatePath(`/series/${seriesId}`);
}
export async function deleteEpisodeAction(id: string, seriesId: string) {
  const db = await getDb();
  const scenes = await db.find<Scene>("scenes", (sc) => sc.episode_id === id);
  for (const sc of scenes) {
    const shots = await db.find<ShotRow>("shots", (sh) => sh.scene_id === sc.id);
    if (shots.some((sh) => sh.status === "LOCKED")) throw new Error("Az epizód LOCKED shotot tartalmaz – nem törölhető.");
  }
  await db.remove("episodes", id);
  revalidatePath(`/series/${seriesId}`);
  redirect(`/series/${seriesId}`);
}
export async function archiveEpisodeAction(id: string, seriesId: string) {
  const db = await getDb();
  await db.update<Episode>("episodes", id, { status: "ARCHIVED" });
  revalidatePath(`/episodes/${id}`); revalidatePath(`/series/${seriesId}`);
}
export async function updateSceneAction(id: string, episodeId: string, fd: FormData) {
  const db = await getDb();
  await db.update<Scene>("scenes", id, { number: Number(fd.get("number")), title: s(fd,"title"), location_id: s(fd,"location_id") || null, summary: s(fd,"summary") });
  revalidatePath(`/episodes/${episodeId}`);
}
export async function reorderSceneAction(id: string, episodeId: string, dir: "up" | "down") {
  const db = await getDb();
  const scenes = (await db.find<Scene>("scenes", (sc) => sc.episode_id === episodeId)).sort((a,b) => a.number - b.number);
  const i = scenes.findIndex((sc) => sc.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= scenes.length) return;
  const a = scenes[i], b = scenes[j];
  await db.update<Scene>("scenes", a.id, { number: b.number });
  await db.update<Scene>("scenes", b.id, { number: a.number });
  revalidatePath(`/episodes/${episodeId}`);
}
export async function reorderShotAction(id: string, sceneId: string, dir: "up" | "down") {
  const db = await getDb();
  const shots = (await db.find<ShotRow>("shots", (sh) => sh.scene_id === sceneId)).sort((a,b) => a.shot_number - b.shot_number);
  const i = shots.findIndex((sh) => sh.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= shots.length) return;
  if (shots[i].status === "LOCKED" || shots[j].status === "LOCKED") throw new Error("LOCKED shot nem mozgatható.");
  const a = shots[i], b = shots[j];
  await db.update<ShotRow>("shots", a.id, { shot_number: b.shot_number, data: { ...a.data, shot_number: b.shot_number } });
  await db.update<ShotRow>("shots", b.id, { shot_number: a.shot_number, data: { ...b.data, shot_number: a.shot_number } });
  revalidatePath(`/episodes/${(await db.get<Scene>("scenes", sceneId))!.episode_id}`);
}
export async function duplicateShotAction(id: string) {
  const db = await getDb();
  const shot = await db.get<ShotRow>("shots", id);
  if (!shot) throw new Error("Shot nem található");
  const siblings = await db.find<ShotRow>("shots", (sh) => sh.scene_id === shot.scene_id);
  const n = Math.max(...siblings.map((x) => x.shot_number)) + 1;
  const newShotId = newId();
  const data = { ...shot.data, shot_id: newShotId, shot_number: n, revision: 1, status: "DRAFT" as const };
  await db.insert<ShotRow>("shots", { id: newShotId, scene_id: shot.scene_id, shot_number: n, status: "DRAFT", revision: 1, data });
  revalidatePath(`/episodes/${shot.data.episode_id}`);
}
export async function updateLocationAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Location>("locations", id, { name: s(fd,"name"), description: s(fd,"description"), variants: s(fd,"variants","DAY").split(",").map((x)=>x.trim()).filter(Boolean), status: s(fd,"status","ACTIVE") });
  revalidatePath("/locations");
}
export async function updatePropAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Prop>("props", id, { name: s(fd,"name"), description: s(fd,"description"), allowed_states: s(fd,"allowed_states","DEFAULT").split(",").map((x)=>x.trim()).filter(Boolean), status: s(fd,"status","ACTIVE") });
  revalidatePath("/props");
}
export async function updateAnimationAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Animation>("animations", id, { name: s(fd,"name"), category: s(fd,"category"), skeleton_profile: s(fd,"skeleton_profile"), duration_sec: Number(fd.get("duration_sec") ?? 1), loopable: fd.get("loopable") === "on", tags: s(fd,"tags").split(",").map((x)=>x.trim()).filter(Boolean), compatibility: s(fd,"compatibility").split(",").map((x)=>x.trim()).filter(Boolean) });
  revalidatePath("/animations");
}
export async function updateVoiceAction(id: string, fd: FormData) {
  const db = await getDb();
  await db.update<Voice>("voices", id, { language: s(fd,"language"), provider: s(fd,"provider"), voice_id: s(fd,"voice_id"), model: s(fd,"model"), stability: Number(fd.get("stability") ?? 0.5), style: Number(fd.get("style") ?? 0) });
  revalidatePath("/voices");
}
export async function testVoiceAction(voiceId: string) {
  const db = await getDb();
  const v = await db.get<Voice>("voices", voiceId);
  if (!v) throw new Error("Voice nem található");
  const { getTtsProvider } = await import("./providers/tts");
  const tts = getTtsProvider();
  const text = "Szia! Ez egy hangpróba a Wonderly Tales Stúdióból.";
  const res = await tts.synthesize(text, { language: v.language, voiceId: v.voice_id, model: v.model, stability: v.stability, style: v.style });
  return res.path;
}
export async function addCostumeAction(characterId: string, fd: FormData) {
  const db = await getDb();
  const versions = await db.find<CharacterVersion>("character_versions", (v) => v.character_id === characterId);
  const latest = versions.sort((a, b) => b.version.localeCompare(a.version))[0];
  if (!latest) throw new Error("Nincs karakterverzió");
  await assertEditable(db, "character_versions", latest.id);
  const costume = s(fd,"costume");
  if (!costume) throw new Error("Costume név kötelező");
  if (!latest.costumes.includes(costume)) await db.update<CharacterVersion>("character_versions", latest.id, { costumes: [...latest.costumes, costume] });
  revalidatePath(`/characters/${characterId}`);
}
