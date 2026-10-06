/**
 * npm run demo:e2e – teljes end-to-end acceptance flow VALÓDI fájloutputokkal.
 * Ha Blender elérhető (BLENDER_PATH / PATH / BLENDER bináris): valódi proxy render SH001-003.
 * Különben: FFmpeg által generált, vizuálisan különböző preview klipek (explicit mock/test mód).
 * Output: artifacts/demo/{previews,hu,en}/ + report.json
 */
import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { JsonDb } from "../src/lib/db/json";
import { buildDemoData } from "../src/lib/seed";
import { setShotStatus, applyContinuity } from "../src/lib/pipeline";
import { localizeEpisode } from "../src/lib/localization";
import { assembleEpisode, generateTestClip, probeFile, ffmpegAvailable } from "../src/lib/assembly";
import { runQc } from "../src/lib/qc";
import { getTtsProvider } from "../src/lib/providers/tts";
import { getFacialProvider } from "../src/lib/providers/facial";
import { aggregateCosts } from "../src/lib/cost";
import type { ShotRow, Episode, QcResult, CostEvent, DialogueLine, RenderJob } from "../src/lib/types";
import { newId, now } from "../src/lib/db";

const run = promisify(execFile);
const ART = path.join(process.cwd(), "artifacts", "demo");
const PREVIEWS = path.join(ART, "previews");
const report: Record<string, unknown> = { steps: [], startedAt: new Date().toISOString() };
function step(name: string, detail: unknown) { (report.steps as unknown[]).push({ name, detail }); console.log(`✔ ${name}`); }

async function findBlender(): Promise<string | null> {
  const cands = [process.env.BLENDER_PATH, "blender", "/tmp/blender-4.5.3-linux-x64/blender"].filter(Boolean) as string[];
  for (const c of cands) { try { await run(c, ["--version"]); return c; } catch { /* next */ } }
  return null;
}

async function blenderRender(blender: string, fixture: string, outDir: string): Promise<{ output: string; renderSec: number; frames: number }> {
  const worker = path.join(process.cwd(), "worker", "blender_worker.py");
  const { stdout } = await run(blender, ["--background", "--python", worker, "--", "--input", fixture, "--output", outDir], { timeout: 300000 });
  const line = stdout.split("\n").filter((l) => l.includes('"status"')).pop()!;
  const r = JSON.parse(line) as { status: string; output: string; render_sec: number; frames: number; error: string | null };
  if (r.status !== "SUCCEEDED") throw new Error(r.error ?? "Blender render FAILED");
  return { output: r.output, renderSec: r.render_sec, frames: r.frames };
}

async function main() {
  const dbFile = path.join(process.cwd(), "data", "demo-e2e.json");
  await fs.rm(dbFile, { force: true });
  await fs.rm(ART, { recursive: true, force: true });
  await fs.mkdir(PREVIEWS, { recursive: true });
  await fs.mkdir(path.dirname(dbFile), { recursive: true });
  await fs.writeFile(dbFile, JSON.stringify(buildDemoData()));
  const db = new JsonDb(dbFile); await db.init();
  step("1. seed (Wonderly Tales / Csodakapu S1E1 / Scene 1 / 3 shot)", {});

  const episode = (await db.list<Episode>("episodes"))[0];
  const shots = (await db.find<ShotRow>("shots", (s) => s.data.episode_id === episode.id)).sort((a,b) => a.shot_number - b.shot_number);
  step("2-4. epizód + scene + 3 shot", { episode: episode.title });

  // 5-6. HU dialógus + TTS + facial
  const tts = getTtsProvider(); const facial = getFacialProvider();
  for (const l of await db.list<DialogueLine>("dialogue_lines")) {
    const audio = await tts.synthesize(l.text, { language: "hu", voiceId: "mock-hu" });
    const track = await facial.generate({ audioPath: audio.path, audioDurationSec: audio.durationSec, text: l.text, facialProfile: "FACE_PROFILE_V1", visemeProfile: "VISEME_15_V1", emotion: l.emotion });
    await db.update<DialogueLine>("dialogue_lines", l.id, { audio_path: audio.path });
    step(`6. TTS+facial: "${l.text.slice(0,28)}…"`, { visemeKeys: track.keys.length });
  }

  // 7. continuity
  const continuityNotes: string[] = [];
  for (const sh of shots) { const r = await applyContinuity(db, sh); r.warnings.forEach((w) => continuityNotes.push(w.message)); }
  step("7. continuity state-ek", { warnings: continuityNotes });

  // 8. Preview render: Blender (ha van) vagy FFmpeg test klipek (explicit mock)
  const blender = await findBlender();
  const clipPaths: string[] = [];
  const renderInfo: Record<string, unknown>[] = [];
  for (const [i, sh] of shots.entries()) {
    const fixture = path.join(process.cwd(), "worker", "fixtures", `shot_sh${String(i+1).padStart(3,"0")}.json`);
    let outPath: string;
    if (blender && (await fs.stat(fixture).catch(() => null))) {
      const r = await blenderRender(blender, fixture, PREVIEWS);
      outPath = path.join(PREVIEWS, `SH${String(sh.shot_number).padStart(3,"0")}.mp4`);
      await fs.copyFile(r.output, outPath); // egységes SH### elnevezés
      renderInfo.push({ shot: i + 1, renderer: "blender", renderSec: r.renderSec, frames: r.frames });
    } else {
      // CI/mock: vizuálisan különböző, kontinuus test klipek (különböző szín + címke + mozgó "karakter")
      const colors = ["0x1d3557", "0x5c3a21", "0x2a4d2e"];
      outPath = path.join(PREVIEWS, `SH${String(sh.shot_number).padStart(3,"0")}.mp4`);
      await generateTestClip(outPath, { durationSec: sh.data.duration_sec, color: colors[i], label: `SH${String(sh.shot_number).padStart(3,"0")} ${sh.data.camera.shot_type}`, movingBox: true });
      renderInfo.push({ shot: i + 1, renderer: "ffmpeg-testclip", durationSec: sh.data.duration_sec });
    }
    clipPaths.push(outPath);
    await db.update<ShotRow>("shots", sh.id, { status: "PREVIEW_RENDERING" });
    const job = await db.insert<RenderJob>("render_jobs", { id: newId(), shot_id: sh.id, type: "PREVIEW", status: "SUCCEEDED", worker: blender ? "blender-local" : "mock", provider: blender ? "blender" : "mock", attempt: 1, max_attempts: 3, input_snapshot: { ...sh.data }, output_path: outPath, gpu_seconds: 0, cost_usd: 0, error: null, created_at: now(), updated_at: now() });
    void job;
    // 9. QC ffprobe-alapú render ellenőrzéssel
    const probe = await probeFile(outPath);
    const qcs = await runQc(db, (await db.get<ShotRow>("shots", sh.id))!, job.id, true);
    step(`8-9. SH${String(sh.shot_number).padStart(3,"0")} preview+QC`, { video: path.basename(outPath), probe: `${probe.width}x${probe.height}@${Math.round(probe.fps)}fps`, qc: qcs.map((q) => `${q.check}:${q.status}`) });
  }

  // 10-11. approve + final render (a preview klipek szolgálnak final outputként a demóban)
  for (const [i, sh] of shots.entries()) {
    await setShotStatus(db, sh.id, "APPROVED_FOR_FINAL");
    await setShotStatus(db, sh.id, "FINAL_RENDERING");
    await db.insert<RenderJob>("render_jobs", { id: newId(), shot_id: sh.id, type: "FINAL", status: "SUCCEEDED", worker: blender ? "blender-local" : "mock", provider: blender ? "blender" : "mock", attempt: 1, max_attempts: 2, input_snapshot: { ...sh.data }, output_path: clipPaths[i], gpu_seconds: 0, cost_usd: 0, error: null, created_at: now(), updated_at: now() });
    await setShotStatus(db, sh.id, "FINAL_READY");
    step(`10-11. SH${String(sh.shot_number).padStart(3,"0")} approve+final`, {});
  }

  // 12. HU assembly – valódi concat a preview/final klipekből
  const hu = await assembleEpisode(db, episode.id, "hu", ART, { clipPaths, title: "Csodakapu S01E01 HU" });
  step("12. HU final assembly (valódi concat)", { master: path.basename(hu.masterPath), renderer: hu.renderer, dur: hu.durationSec, clips: hu.clipCount });

  // 13-15. EN localization + EN master UGYANAZOKBÓL a videókból (nincs újrarender)
  const renderJobsBefore = (await db.list<RenderJob>("render_jobs")).length;
  await localizeEpisode(db, episode.id, "en");
  const en = await assembleEpisode(db, episode.id, "en", ART, { clipPaths, title: "Csodakapu S01E01 EN" });
  const renderJobsAfter = (await db.list<RenderJob>("render_jobs")).length;
  step("13-15. EN localization + assembly", {
    localizedAudio: path.basename(en.audioPath),
    noReRender: renderJobsBefore === renderJobsAfter,
    proof: "EN assembly ugyanazokat a klip-fájlokat használta, új render job nem jött létre",
  });

  // 16. cost report
  const costs = aggregateCosts(await db.list<CostEvent>("cost_events"));
  step("16. cost report", { total: costs.total.toFixed(3) });

  report.finishedAt = new Date().toISOString();
  report.artifacts = {
    previews: clipPaths.map((p) => path.relative(ART, p)),
    hu: { master: "hu/master.mp4", subtitles: "hu/subtitles.srt", audio: "hu/audio_master.aac" },
    en: { master: "en/master.mp4", subtitles: "en/subtitles.srt", audio: "en/audio_master.aac" },
  };
  report.blender = blender;
  report.ffmpeg = await ffmpegAvailable();
  report.noReRenderForLocalization = renderJobsBefore === renderJobsAfter;
  report.renderInfo = renderInfo;
  report.costs = costs;
  await fs.writeFile(path.join(ART, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nDemo kész → ${path.relative(process.cwd(), ART)}/report.json`);
}
main().catch((e) => { console.error("DEMO E2E FAILED:", e); process.exit(1); });
