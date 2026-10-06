/** Demo seed: Wonderly Tales → Csodakapu → Season 1 → Episode 1 → Scene 1 → 3 shot */
import type { ShotData } from "./schemas/shot";

export function buildDemoData(): Record<string, unknown[]> {
  const id = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  const project = { id: id(), name: "Wonderly Tales", code: "WT", created_at: now() };
  const series = { id: id(), project_id: project.id, name: "Csodakapu", international_name: "Wondergate", bible: "Makkfalva melletti erdőben áll a Csodakapu, amely különös világokba vezet. A főszereplők minden részben egy új világot fedeznek fel, miközben a kapu titkát főnixik.", age_range: "4-9", fps: 24, resolution: "1920x1080", visual_style: "stilizált 3D, meleg színek", status: "ACTIVE" };
  const season = { id: id(), series_id: series.id, number: 1, title: "A kapu felébred", arc: "A Csodakapu újra aktiválódik, a csapat összeáll.", status: "IN_PRODUCTION" };
  const episode = { id: id(), season_id: season.id, number: 1, title: "A csillagszilánk", brief: "Márk és Lili egy hullócsillag-szilánkot találnak, ami felébreszti a Csodakaput.", target_duration_sec: 1320, master_language: "hu", script_version: "SCRIPT_V1", status: "IN_PRODUCTION", estimated_cost: 240, actual_cost: 0 };

  const chars = [
    { code: "CHAR_MARK", name: "Márk", species: "emberi fiú", type: "CORE", personality: "kíváncsi, bátor", visual_description: "8 éves, barna haj, piros kapucnis pulcsi", speech_style: "élénk, kérdező", gender: "fiú" },
    { code: "CHAR_LILI", name: "Lili", species: "róka", type: "CORE", personality: "okos, fürge", visual_description: "vörös róka, fehér farokvég", speech_style: "szellemes", gender: "nő" },
    { code: "CHAR_MORZSI", name: "Morzsi", species: "medve", type: "CORE", personality: "jószívű óriás", visual_description: "barna medvebocs-méret és felnőtt között", speech_style: "lassú, meleg", gender: "férfi" },
    { code: "CHAR_POTTY", name: "Pötty", species: "nyúl", type: "CORE", personality: "izgága", visual_description: "fehér nyúl fekete foltokkal", speech_style: "gyors", gender: "nő" },
    { code: "CHAR_BOGYO", name: "Bogyó", species: "kiskutya", type: "CORE", personality: "hűséges", visual_description: "pöttöm eb, örök farokcsóválás", speech_style: "ugat, de értik", gender: "férfi" },
    { code: "CHAR_ZIZI", name: "Zizi", species: "mosómedve feltaláló", type: "RECURRING", personality: "zseniális, szétszórt", visual_description: "mosómedve kis szemüveggel, szerszámos öv", speech_style: "műszaki zsargon", gender: "nő" },
  ].map((c) => ({ id: id(), age_description: "gyerek", status: "ACTIVE", thumbnail: null, ...c }));

  const charVersions = chars.map((c) => ({ id: id(), character_id: c.id, version: "V001", asset_id: `${c.code}_V001`, master_model_path: null, rig_profile: "STANDARD_BIPED_V1", facial_profile: "FACE_PROFILE_V1", viseme_profile: "VISEME_15_V1", hair_fur_meta: c.species === "emberi fiú" ? {} : { fur: "short", groom: "default" }, scale: 1, costumes: ["default"], expressions: ["neutral","happy","sad","angry","surprise","excited"], retarget_profile: "RETARGET_V1", status: "LOCKED", locked_at: now() }));

  const forest = { id: id(), code: "LOC_FOREST", name: "Makkfalvi erdő", description: "Az erdő a Csodakapuval a tisztáson", variants: ["DAY","NIGHT","RAIN","WINTER"], status: "ACTIVE" };
  const forestV = { id: id(), location_id: forest.id, version: "V001", asset_id: "LOC_FOREST_V001", blender_asset_path: null, fixed_layout: true, status: "LOCKED", locked_at: now() };
  const prop = { id: id(), code: "PROP_STAR_FRAGMENT", name: "Csillagszilánk", description: "Fénylő meteoritdarab, ami aktiválja a kaput", allowed_states: ["DORMANT","GLOWING","ACTIVE"], status: "ACTIVE" };
  const propV = { id: id(), prop_id: prop.id, version: "V001", asset_id: "PROP_STAR_FRAGMENT_V001", asset_path: null, status: "LOCKED", locked_at: now() };

  const animations = ["idle_breathe","walk_casual","run_excited","jump_joy","sit_ground","stand_up","turn_look","point_forward","wave_hello","grab_object","carry_small","push_gate","climb_rock","fall_soft","laugh_big","cry_sniff","fear_stepback","surprise_gasp","anger_stomp","excited_bounce","listening_tilt","talk_gesture","group_cheer"].map((code, i) => ({ id: id(), code, name: code.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "), category: code.split("_")[0], skeleton_profile: "STANDARD_BIPED_V1", source_asset: null, duration_sec: 1.2 + (i % 5) * 0.4, loopable: ["idle_breathe","walk_casual","run_excited"].includes(code), tags: ["core"], compatibility: ["CHAR_MARK","CHAR_LILI","CHAR_MORZSI","CHAR_POTTY","CHAR_BOGYO","CHAR_ZIZI"] }));

  const scene = { id: id(), episode_id: episode.id, number: 1, title: "Az erdő tisztása", location_id: forest.id, summary: "Márk és Lili megtalálja a csillagszilánkot a kapunál." };

  const [mark, lili, morzsi] = chars;
  const mkShot = (n: number, charList: typeof chars, dialogueText: string, dur: number): ShotData => ({
    schema_version: "SHOT_SCHEMA_V1",
    shot_id: id(), episode_id: episode.id, scene_id: scene.id,
    shot_number: n, revision: 1, status: "SCRIPTED", duration_sec: dur,
    location: { location_id: forest.id, asset_id: "LOC_FOREST_V001", asset_version: "V001", variant: "DAY" },
    characters: charList.map((c, i) => ({ character_id: c.id, asset_id: `${c.code}_V001`, asset_version: "V001", costume_id: "default", position: [i * 1.5, 0, 0] as [number,number,number], rotation: [0, 0, 0] as [number,number,number], animation_code: i === 0 ? "walk_casual" : "idle_breathe", emotion: "curious" as const, look_at: null })),
    props: n >= 2 ? [{ prop_id: prop.id, asset_id: "PROP_STAR_FRAGMENT_V001", asset_version: "V001", state: n === 3 ? "GLOWING" : "DORMANT", position: [0.8, 0, 0.4] as [number,number,number] }] : [],
    dialogue: [], camera: { shot_type: n === 1 ? "WIDE" : n === 2 ? "MEDIUM" : "CLOSE_UP", lens_mm: n === 1 ? 24 : 35, target: null, movement: "STATIC" as const, preset: null },
    lighting: { preset: "DAY" as const, time_of_day: "16:00" },
    animation: { notes: "" },
    audio: { dialogue_track: null, sfx: [], music_cue: "main_theme_soft", ambience: "forest_day" },
    vfx: { mode: "BLENDER" as const, provider: null, reference_frames: [], max_cost_usd: 0 },
    continuity: { input_state_id: null, output_state_id: null },
    render: { engine: "MOCK" as const, width: 1920, height: 1080, fps: 24, quality: "PREVIEW" as const, priority: 50 },
    qc: { profile: "DEFAULT", minimum_score: 70, required_checks: ["ASSET_VERSION","CHARACTER","CAMERA","RENDER_CORRUPTION"] },
    cost: { estimated_usd: 0, actual_usd: 0 },
  });

  const shotData = [ mkShot(1, [mark, lili], "", 8), mkShot(2, [mark, lili], "Nézd, Lili! Ez a kő... világít!", 6), mkShot(3, [mark, lili, morzsi], "A kapu... ébred!", 7) ];
  const shots = shotData.map((d) => ({ id: d.shot_id, scene_id: scene.id, shot_number: d.shot_number, status: d.status, revision: 1, data: d }));

  const dialogueLines = [
    { id: id(), scene_id: scene.id, shot_id: shots[1].id, character_id: mark.id, sequence: 1, text: "Nézd, Lili! Ez a kő... világít!", language: "hu", emotion: "excited", audio_path: null },
    { id: id(), scene_id: scene.id, shot_id: shots[1].id, character_id: lili.id, sequence: 2, text: "Óvatosan, Márk! Ilyet még sosem láttam.", language: "hu", emotion: "curious", audio_path: null },
    { id: id(), scene_id: scene.id, shot_id: shots[2].id, character_id: morzsi.id, sequence: 3, text: "A kapu... ébred!", language: "hu", emotion: "surprise", audio_path: null },
  ];
  shots[1].data.dialogue = [{ dialogue_line_id: dialogueLines[0].id, character_id: mark.id, text: dialogueLines[0].text, language: "hu" }, { dialogue_line_id: dialogueLines[1].id, character_id: lili.id, text: dialogueLines[1].text, language: "hu" }];
  shots[2].data.dialogue = [{ dialogue_line_id: dialogueLines[2].id, character_id: morzsi.id, text: dialogueLines[2].text, language: "hu" }];

  const voices = chars.map((c) => ({ id: id(), character_id: c.id, language: "hu", provider: "mock", voice_id: `mock-hu-${c.name.toLowerCase()}`, model: "mock-v1", stability: 0.5, style: 0.2 }));

  return {
    projects: [project], series: [series], seasons: [season], episodes: [episode],
    scenes: [scene], shots, characters: chars, character_versions: charVersions,
    voices, locations: [forest], location_versions: [forestV],
    props: [prop], prop_versions: [propV], animations,
    dialogue_lines: dialogueLines, localized_dialogue_lines: [], assets: [],
    continuity_states: [], render_jobs: [], qc_results: [], cost_events: [],
    translation_jobs: [], episode_localizations: [
      { id: id(), episode_id: episode.id, language: "hu", status: "READY", audio_master_path: null, subtitle_path: null },
      { id: id(), episode_id: episode.id, language: "en", status: "MISSING", audio_master_path: null, subtitle_path: null },
      { id: id(), episode_id: episode.id, language: "de", status: "MISSING", audio_master_path: null, subtitle_path: null },
      { id: id(), episode_id: episode.id, language: "es", status: "MISSING", audio_master_path: null, subtitle_path: null },
      { id: id(), episode_id: episode.id, language: "fr", status: "MISSING", audio_master_path: null, subtitle_path: null },
    ],
  };
}
