/**
 * FinalAssemblyService – approved final shot videók összefűzése production minőségben.
 *
 * Production mód (default): minden final shot videó KÖTELEZŐ – hiányzó fájl = FAIL.
 * Mock mód (explicit `{ mock: true }`): teszt/CI placeholder klipek generálhatók.
 *
 * Pipeline: input ellenőrzés → per-clip normalizálás (1920×1080, fps, yuv420p, AAC 48k) →
 * concat (helyes sorrend) → audio rétegek keverése (dialogue/ambience/music) →
 * loudnorm loudness-kezelés → 1080p H.264/AAC master + SRT/VTT + metadata JSON.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import type { Db } from "./db";
import { newId, now } from "./db";
import { getStorage } from "./providers/storage";
import type { ShotRow, DialogueLine, LocalizedLine, Scene, RenderJob, CostEvent } from "./types";

const run = promisify(execFile);

function ffmpeg(): string { return process.env.FFMPEG_PATH || "ffmpeg"; }
function ffprobe(): string { return process.env.FFPROBE_PATH || "ffprobe"; }
export async function ffmpegAvailable(): Promise<boolean> {
  try { await run(ffmpeg(), ["-version"]); return true; } catch { return false; }
}

/** Silence has no finite integrated loudness; leave it silent instead of applying infinite gain. */
async function loudnessFilter(file: string): Promise<string> {
  const { stderr } = await run(ffmpeg(), ["-hide_banner", "-i", file, "-vn", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { maxBuffer: 4 * 1024 * 1024 });
  const report = stderr.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0];
  if (!report) throw new AssemblyError("FFmpeg loudness analysis returned no measurements.");
  const measured = JSON.parse(report) as Record<string, string>;
  const fields = ["input_i", "input_tp", "input_lra", "input_thresh", "target_offset"];
  if (!fields.every((key) => Number.isFinite(Number(measured[key])))) return "aresample=48000,aformat=channel_layouts=stereo";
  return `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true,aresample=48000,aformat=channel_layouts=stereo`;
}

export interface ProbeResult { width: number; height: number; fps: number; durationSec: number; videoCodec: string; audioCodec: string | null; }
export async function probeFile(file: string): Promise<ProbeResult> {
  const { stdout } = await run(ffprobe(), ["-v","error","-print_format","json","-show_format","-show_streams",file]);
  const data = JSON.parse(stdout) as { format: { duration: string }; streams: { codec_type: string; codec_name: string; width?: number; height?: number; r_frame_rate?: string }[] };
  const v = data.streams.find((s) => s.codec_type === "video");
  const a = data.streams.find((s) => s.codec_type === "audio");
  const [fn, fd] = (v?.r_frame_rate ?? "24/1").split("/").map(Number);
  return { width: v?.width ?? 0, height: v?.height ?? 0, fps: fd ? fn / fd : fn, durationSec: parseFloat(data.format.duration), videoCodec: v?.codec_name ?? "", audioCodec: a?.codec_name ?? null };
}

export function srtTime(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60), ms = Math.round((sec % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}
export function vttTime(sec: number): string { return srtTime(sec).replace(",", "."); }
export function buildSrt(cues: { start: number; end: number; text: string }[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join("\n");
}
export function buildVtt(cues: { start: number; end: number; text: string }[]): string {
  return "WEBVTT\n\n" + cues.map((c) => `${vttTime(c.start)} --> ${vttTime(c.end)}\n${c.text}\n`).join("\n");
}

export class AssemblyError extends Error {}

export interface AssemblyInput {
  clips: { shotNumber: number; path: string }[];  // helyes sorrendben
  audioLayers?: { kind: "dialogue"|"ambience"|"sfx"|"music"; path: string; volume?: number; startSec?: number }[];
  cues: { start: number; end: number; text: string }[];
  outDir: string;
  title?: string;
}
export interface AssemblyResult { masterPath: string; audioPath: string; subtitlePath: string; vttPath: string; metadataPath: string; durationSec: number; renderer: "ffmpeg" | "mock"; clipCount: number; }

/** Valódi concat assembly – production implementáció */
export async function assembleClips(input: AssemblyInput): Promise<AssemblyResult> {
  if (input.clips.length === 0) throw new AssemblyError("Nincs egyetlen shot videó sem – assembly megtagadva.");
  await fs.mkdir(input.outDir, { recursive: true });

  // 1. minden input létezik?
  for (const c of input.clips) {
    try { await fs.access(c.path); } catch {
      throw new AssemblyError(`Hiányzó final shot videó: SH${String(c.shotNumber).padStart(3,"0")} → ${c.path} (production módban placeholder NEM megengedett)`);
    }
  }

  // 2. per-clip normalizálás: 1920×1080 (scale+pad), 24 fps, yuv420p, H.264 + 48kHz stereo AAC
  const normDir = path.join(input.outDir, ".norm");
  await fs.mkdir(normDir, { recursive: true });
  const normFiles: string[] = [];
  for (const c of input.clips) {
    const norm = path.join(normDir, `n_${String(c.shotNumber).padStart(3,"0")}.mp4`);
    const probe = await probeFile(c.path);
    const hasAudio = probe.audioCodec !== null;
    const inputs = hasAudio ? ["-i", c.path] : ["-i", c.path, "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${probe.durationSec}`];
    const audioFilter = hasAudio ? await loudnessFilter(c.path) : "aresample=48000,aformat=channel_layouts=stereo";
    const maps = hasAudio ? ["-map","0:v","-map","0:a"] : ["-map","0:v","-map","1:a"];
    await run(ffmpeg(), ["-y",...inputs,...maps,
      "-vf","scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p",
      "-c:v","libx264","-preset","fast","-crf","20",
      "-af",audioFilter,
      "-ar","48000","-ac","2","-c:a","aac","-b:a","192k","-shortest",norm]);
    normFiles.push(norm);
  }

  // 3. concat helyes sorrendben (demuxer, már uniform stream-ek)
  const listFile = path.join(normDir, "concat.txt");
  await fs.writeFile(listFile, normFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const videoOnly = path.join(normDir, "video_concat.mp4");
  await run(ffmpeg(), ["-y","-f","concat","-safe","0","-i",listFile,"-c","copy",videoOnly]);

  // 4. audio rétegek keverése (dialogue/ambience/sfx/music), ha vannak valós fájlok
  const layers = (input.audioLayers ?? []).filter(() => true);
  const existingLayers: typeof layers = [];
  for (const l of layers) {
    try { await fs.access(l.path); existingLayers.push(l); }
    catch { throw new AssemblyError(`Hiányzó audio layer: ${l.path}`); }
  }
  const masterPath = path.join(input.outDir, "master.mp4");
  const audioPath = path.join(input.outDir, "audio_master.aac");
  let mixPath = videoOnly;
  if (existingLayers.length > 0) {
    const inputs = existingLayers.flatMap((l) => ["-i", l.path]);
    const filterParts = existingLayers.map((l, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${l.volume ?? (l.kind === "music" ? 0.3 : l.kind === "ambience" ? 0.4 : 1)},adelay=${Math.round((l.startSec ?? 0) * 1000)}:all=1[a${i}]`);
    const mix = `${existingLayers.map((_, i) => `[a${i}]`).join("")}amix=inputs=${existingLayers.length}:duration=longest,apad[aout]`;
    mixPath = path.join(normDir, "mix.wav");
    await run(ffmpeg(), ["-y",...inputs,"-filter_complex",[...filterParts,mix].join(";"),"-map","[aout]","-ar","48000","-ac","2","-c:a","pcm_s16le","-t",String((await probeFile(videoOnly)).durationSec),mixPath]);
  }
  const finalFilter = await loudnessFilter(mixPath);
  await run(ffmpeg(), ["-y","-i",videoOnly,"-i",mixPath,"-map","0:v:0","-map","1:a:0","-af",finalFilter,"-c:v","copy","-ar","48000","-ac","2","-c:a","aac","-b:a","192k","-shortest",masterPath]);
  await run(ffmpeg(), ["-y","-i",masterPath,"-vn","-c:a","copy",audioPath]);

  // 5. subtitle + metadata
  const subtitlePath = path.join(input.outDir, "subtitles.srt");
  const vttPath = path.join(input.outDir, "subtitles.vtt");
  await fs.writeFile(subtitlePath, buildSrt(input.cues), "utf8");
  await fs.writeFile(vttPath, buildVtt(input.cues), "utf8");
  const probe = await probeFile(masterPath);
  const metadataPath = path.join(input.outDir, "metadata.json");
  const meta = { title: input.title ?? "", clips: input.clips.map((c) => ({ shot: c.shotNumber, path: c.path })), audioLayers: existingLayers, probe, cues: input.cues.length, renderer: "ffmpeg", createdAt: now() };
  await fs.writeFile(metadataPath, JSON.stringify(meta, null, 2));
  await fs.rm(normDir, { recursive: true, force: true });
  return { masterPath, audioPath, subtitlePath, vttPath, metadataPath, durationSec: probe.durationSec, renderer: "ffmpeg", clipCount: input.clips.length };
}

/** Explicit mock/test placeholder clip generálás (CI, ha nincs renderelt shot) */
export async function generateTestClip(outPath: string, opts: { durationSec: number; color: string; label: string; movingBox?: boolean }): Promise<void> {
  const filters = [`drawtext=text='${opts.label}':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=60`];
  if (opts.movingBox) filters.push(`drawbox=x='50+mod(t*200\\,1500)':y=400:w=120:h=120:color=yellow:t=fill`);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await run(ffmpeg(), ["-y","-f","lavfi","-i",`color=c=${opts.color}:s=1920x1080:d=${opts.durationSec}:r=24`,
    "-f","lavfi","-i",`anullsrc=r=48000:cl=stereo:d=${opts.durationSec}`,
    "-vf",filters.join(","),"-c:v","libx264","-pix_fmt","yuv420p","-ar","48000","-ac","2","-c:a","aac","-shortest",outPath]);
}

/** Epizód assembly egy adott nyelvre – shot sorrend, dialogue cue-k, cost event */
export async function assembleEpisode(db: Db, episodeId: string, lang: string, outRoot: string, opts: { mock?: boolean; clipPaths?: string[]; title?: string } = {}): Promise<AssemblyResult> {
  const scenes = (await db.find<Scene>("scenes", (s) => s.episode_id === episodeId)).sort((a,b) => a.number - b.number);
  const shots: ShotRow[] = [];
  for (const sc of scenes) shots.push(...(await db.find<ShotRow>("shots", (sh) => sh.scene_id === sc.id && ["FINAL_READY","LOCKED"].includes(sh.status))).sort((a,b) => a.shot_number - b.shot_number));

  const outDir = path.join(outRoot, lang);
  await fs.mkdir(outDir, { recursive: true });

  const inputDir = path.join(outDir, ".inputs");
  await fs.mkdir(inputDir, { recursive: true });
  async function resolveStored(key: string, name: string): Promise<string> {
    const destination = path.join(inputDir, name);
    await fs.writeFile(destination, await getStorage().get(key));
    return destination;
  }

  // Shot videók feloldása: explicit clipPaths > render_jobs output > (mock) generált placeholder
  const clips: { shotNumber: number; path: string }[] = [];
  for (const [i, sh] of shots.entries()) {
    let p = opts.clipPaths?.[i];
    if (!p) {
      const jobs = (await db.find<RenderJob>("render_jobs", (j) => j.shot_id === sh.id && j.type === "FINAL" && j.status === "SUCCEEDED" && !!j.output_path)).sort((a,b) => b.created_at.localeCompare(a.created_at));
      if (jobs[0]?.output_path) p = await resolveStored(jobs[0].output_path, `clip_${i}.mp4`);
    }
    if (p) { clips.push({ shotNumber: sh.shot_number, path: p }); continue; }
    if (!opts.mock) throw new AssemblyError(`SH${String(sh.shot_number).padStart(3,"0")}: nincs final shot videó – production assembly FAIL.`);
    // explicit mock mód: vizuálisan különböző placeholder clip
    const colors = ["0x2c3e50","0x4a2c50","0x2c5038"];
    const ph = path.join(outDir, ".mock", `clip_${sh.shot_number}.mp4`);
    await generateTestClip(ph, { durationSec: sh.data.duration_sec, color: colors[i % 3], label: `SH${String(sh.shot_number).padStart(3,"0")}`, movingBox: true });
    clips.push({ shotNumber: sh.shot_number, path: ph });
  }

  // Dialogue cue-k shot-sorrendben, nyelv szerinti szöveggel
  const allLines = await db.list<DialogueLine>("dialogue_lines");
  const locLines = await db.list<LocalizedLine>("localized_dialogue_lines");
  const cues: { start: number; end: number; text: string }[] = [];
  const audioLayers: NonNullable<AssemblyInput["audioLayers"]> = [];
  let t = 0;
  for (const sh of shots) {
    let local = 0;
    for (const d of sh.data.dialogue) {
      const master = allLines.find((l) => l.id === d.dialogue_line_id);
      const localized = master ? locLines.find((l) => l.dialogue_line_id === master.id && l.language === lang) : null;
      if (!opts.mock && lang !== "hu" && !localized) throw new AssemblyError(`Hiányzó ${lang} fordítás: ${d.dialogue_line_id}`);
      const text = lang === "hu" ? (master?.text ?? d.text) : (localized?.text ?? d.text);
      let dur = Math.max(1.5, text.length / 14);
      if (!opts.mock) {
        const key = lang === "hu" ? master?.audio_path : localized?.audio_path;
        if (!key) throw new AssemblyError(`Hiányzó ${lang} dialógushang: ${d.dialogue_line_id}`);
        const audioFile = await resolveStored(key, `dialogue_${audioLayers.length}${path.extname(key) || ".mp3"}`);
        dur = (await probeFile(audioFile)).durationSec;
        if (!Number.isFinite(dur) || dur <= 0 || local + dur > sh.data.duration_sec + 0.05) throw new AssemblyError(`A ${lang} dialógus nem fér a shot időtartamába: ${sh.shot_number}`);
        audioLayers.push({ kind: "dialogue", path: audioFile, startSec: t + local });
      }
      cues.push({ start: t + local, end: t + local + dur, text });
      local += dur;
    }
    t += sh.data.duration_sec;
  }

  if (!(await ffmpegAvailable())) {
    if (!opts.mock) throw new AssemblyError("FFmpeg nem elérhető – production assembly nem végezhető el.");
    // FFmpeg nélküli fallback (pl. minimális CI): metadata + placeholder fájlok
    const masterPath = path.join(outDir, "master.mp4");
    const audioPath = path.join(outDir, "audio_master.aac");
    const subtitlePath = path.join(outDir, "subtitles.srt");
    const vttPath = path.join(outDir, "subtitles.vtt");
    await fs.writeFile(masterPath, `MOCK MASTER ${episodeId} ${lang}`);
    await fs.writeFile(audioPath, "MOCK AUDIO");
    await fs.writeFile(subtitlePath, buildSrt(cues), "utf8");
    await fs.writeFile(vttPath, buildVtt(cues), "utf8");
    const metadataPath = path.join(outDir, "metadata.json");
    await fs.writeFile(metadataPath, JSON.stringify({ episodeId, lang, durationSec: t, clips: clips.length, renderer: "mock", createdAt: now() }, null, 2));
    return { masterPath, audioPath, subtitlePath, vttPath, metadataPath, durationSec: t, renderer: "mock", clipCount: clips.length };
  }

  const result = await assembleClips({ clips, cues, audioLayers, outDir, title: opts.title ?? `E-${episodeId}-${lang}` });
  await db.insert<CostEvent>("cost_events", { id: newId(), project_id: null, series_id: null, episode_id: episodeId, shot_id: null, category: "GPU", provider: "assembly", service: "assembly", language: lang, amount_usd: 0, quantity: result.durationSec, unit: "sec", unit_price_usd: 0, currency: "USD", created_at: now() }).catch(() => {});
  return result;
}
