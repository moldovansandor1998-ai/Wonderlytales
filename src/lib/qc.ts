import type { Db } from "./db";
import { newId, now } from "./db";
import { probeFile, ffmpegAvailable } from "./assembly";
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { getStorage } from './providers/storage';
import type { QcResult, QcStatus, ShotRow, Character, CharacterVersion, Location, LocationVersion, Prop, PropVersion, DialogueLine } from "./types";

export const QC_CHECKS = ["ASSET_VERSION","CHARACTER","COSTUME","LOCATION","PROP_CONTINUITY","CLIPPING","CAMERA","EYE_DIRECTION","LIPSYNC","FACIAL_ANIMATION","BODY_ANIMATION","AUDIO","RENDER_CORRUPTION","STORY_CONTINUITY","STATIC_SHOT"] as const;

type CheckFn = (ctx: QcCtx) => { status: QcStatus; score: number; details: string };
interface QcCtx {
  shot: ShotRow;
  chars: Character[]; charVersions: CharacterVersion[];
  locs: Location[]; locVersions: LocationVersion[];
  props: Prop[]; propVersions: PropVersion[];
  dialogueLines: DialogueLine[];
  renderExists: boolean;
  renderProbe?: { width: number; height: number; fps: number; durationSec: number } | null;
}

const ok = (score = 95, details = "OK") => ({ status: "PASS" as QcStatus, score, details });
const warn = (score: number, details: string) => ({ status: "WARNING" as QcStatus, score, details });
const fail = (score: number, details: string) => ({ status: "FAIL" as QcStatus, score, details });

/** Determinisztikus, valódi checkek */
const DETERMINISTIC: Record<string, CheckFn> = {
  ASSET_VERSION: ({ shot, charVersions, locVersions, propVersions }) => {
    const lockedIds = new Set([...charVersions.filter(v=>v.status==="LOCKED").map(v=>v.asset_id), ...locVersions.filter(v=>v.status==="LOCKED").map(v=>v.asset_id), ...propVersions.filter(v=>v.status==="LOCKED").map(v=>v.asset_id)]);
    const used = [...shot.data.characters.map(c=>c.asset_id), shot.data.location.asset_id, ...shot.data.props.map(p=>p.asset_id)];
    const notLocked = used.filter((a) => a !== "UNKNOWN" && !lockedIds.has(a));
    return notLocked.length ? fail(20, `Nem lockolt asset használata: ${notLocked.join(", ")}`) : ok();
  },
  CHARACTER: ({ shot, chars }) => {
    const missing = shot.data.characters.filter((c) => !chars.some((x) => x.id === c.character_id));
    if (missing.length) return fail(10, "Ismeretlen karakter a shotban");
    return shot.data.characters.length === 0 ? warn(60, "Nincs karakter a shotban") : ok();
  },
  COSTUME: ({ shot, charVersions }) => {
    const bad = shot.data.characters.filter((c) => {
      const v = charVersions.find((x) => x.character_id === c.character_id && x.version === c.asset_version);
      return v && c.costume_id && !v.costumes.includes(c.costume_id);
    });
    return bad.length ? fail(30, "Nem létező costume hivatkozás") : ok();
  },
  LOCATION: ({ shot, locs, locVersions }) => {
    const loc = locs.find((l) => l.id === shot.data.location.location_id);
    if (!loc) return fail(10, "Ismeretlen helyszín");
    if (!loc.variants.includes(shot.data.location.variant)) return warn(50, `Ismeretlen variáns: ${shot.data.location.variant}`);
    if (!locVersions.some((v) => v.location_id === loc.id && v.version === shot.data.location.asset_version)) return fail(25, "Ismeretlen helyszín verzió");
    return ok();
  },
  PROP_CONTINUITY: ({ shot, props }) => {
    const bad = shot.data.props.filter((p) => {
      const prop = props.find((x) => x.id === p.prop_id);
      return !prop || !prop.allowed_states.includes(p.state);
    });
    return bad.length ? fail(30, "Érvénytelen prop vagy prop state") : ok();
  },
  AUDIO: ({ shot, dialogueLines }) => {
    if (shot.data.dialogue.length === 0) return ok(90, "Nincs dialógus");
    const missing = shot.data.dialogue.filter((d) => !dialogueLines.some((l) => l.id === d.dialogue_line_id));
    if (missing.length) return warn(55, "Dialógus sor nincs a dialogue_lines táblában");
    if (!shot.data.audio.dialogue_track) return warn(60, "Dialógushoz nincs audio track (még)");
    return ok();
  },
  RENDER_CORRUPTION: ({ shot, renderExists, renderProbe }) => {
    if (shot.status === "DRAFT" || shot.status === "SCRIPTED") return ok(90, "Még nincs render");
    if (!renderExists) return fail(15, "Render output nem létezik / sérült");
    if (renderProbe) {
      const exp = shot.data.render;
      const issues: string[] = [];
      if (renderProbe.width !== exp.width || renderProbe.height !== exp.height) issues.push(`felbontás ${renderProbe.width}x${renderProbe.height} ≠ ${exp.width}x${exp.height}`);
      if (Math.abs(renderProbe.fps - exp.fps) > 0.5) issues.push(`fps ${renderProbe.fps.toFixed(1)} ≠ ${exp.fps}`);
      if (Math.abs(renderProbe.durationSec - shot.data.duration_sec) > 1.5) issues.push(`duration ${renderProbe.durationSec.toFixed(1)}s ≠ ${shot.data.duration_sec}s`);
      if (issues.length) return fail(30, `Render meta eltérés: ${issues.join("; ")}`);
      return ok(98, `ffprobe OK: ${renderProbe.width}x${renderProbe.height}@${renderProbe.fps.toFixed(0)}fps, ${renderProbe.durationSec.toFixed(1)}s`);
    }
    return warn(0, "A videó műszaki ellenőrzése nem futott le.");
  },
  STATIC_SHOT: ({ shot }) => (shot.data.camera.movement === "STATIC" && shot.data.duration_sec > 20) ? warn(55, "Hosszú statikus shot") : ok(),
  STORY_CONTINUITY: () => ok(85, "Continuity engine által kezelt"),
};

/** Vision/AI jellegű checkek – provider adapter mögött (mock) */
function visionCheck(name: string): { status: QcStatus; score: number; details: string } {
  return warn(0, `${name}: valódi QC provider nincs bekötve – ellenőrzés szükséges`);
}

export async function runQc(db: Db, shot: ShotRow, jobId: string | null, renderExists = false, renderPath?: string | null): Promise<QcResult[]> {
  let renderProbe: QcCtx["renderProbe"] = null;
  if (renderPath && (await ffmpegAvailable())) {
    let temporary: string | null = null;
    try {
      let file=renderPath;
      if (!path.isAbsolute(file)) {
        temporary=await fs.mkdtemp(path.join(tmpdir(),'wonderly-qc-'));
        file=path.join(temporary,'clip.mp4');
        await fs.writeFile(file,await getStorage().get(renderPath));
      }
      renderProbe = await probeFile(file);
    } catch { renderExists = false; }
    finally { if (temporary) await fs.rm(temporary,{recursive:true,force:true}); }
  }
  const ctx: QcCtx = {
    shot,
    chars: await db.list<Character>("characters"),
    charVersions: await db.list<CharacterVersion>("character_versions"),
    locs: await db.list<Location>("locations"),
    locVersions: await db.list<LocationVersion>("location_versions"),
    props: await db.list<Prop>("props"),
    propVersions: await db.list<PropVersion>("prop_versions"),
    dialogueLines: await db.list<DialogueLine>("dialogue_lines"),
    renderExists,
    renderProbe,
  };
  const results: QcResult[] = [];
  const requested = shot.data.qc.required_checks.length ? shot.data.qc.required_checks : [...QC_CHECKS];
  // Native cinema work must not omit acting, lip sync or contact checks.
  const checks=shot.data.native_scene ? [...new Set([...requested,...QC_CHECKS])] : requested;
  for (const check of checks) {
    const r = DETERMINISTIC[check] ? DETERMINISTIC[check](ctx) : visionCheck(check);
    results.push(await db.insert<QcResult>("qc_results", { id: newId(), shot_id: shot.id, job_id: jobId, check_name: check, status: r.status, score: r.score, details: r.details, created_at: now() }));
  }
  const min = shot.data.qc.minimum_score;
  const worst = results.reduce((a, r) => Math.min(a, r.score), 100);
  const hasFail = results.some((r) => r.status === "FAIL");
  const newStatus = hasFail ? "QC_FAILED" : worst < min ? "QC_WARNING" : "PREVIEW_READY";
  await db.update<ShotRow>("shots", shot.id, { status: newStatus });
  return results;
}

export const AUTO_RETRY_CHECKS = ["RENDER_CORRUPTION", "CLIPPING"];
export function shouldAutoRetry(check: string, status: QcStatus, attempts: number, maxAttempts: number): boolean {
  return status === "FAIL" && AUTO_RETRY_CHECKS.includes(check) && attempts < maxAttempts;
}
