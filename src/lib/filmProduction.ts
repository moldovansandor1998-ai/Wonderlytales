export interface FilmRun {
 id: string; episode_id: string | null; title: string; mode: "DIAGNOSTIC" | "FEATURE";
 status: string; fps: number; frames: number; scene_count: number;
 quality_report: Record<string, unknown>; output_key: string | null; error: string | null;
 created_at: string;
}
export interface FilmTask {
 id: string; run_id: string; ordinal: number; scene_id: string; status: string; frames: number;
 attempts: number; max_attempts: number; external_job_id: string | null; kind?: string;
 output_key: string | null; error: string | null;
}
export interface FilmControl {
 scheduler_heartbeat: string | null; dispatch_enabled: boolean; endpoint_verified: boolean;
 active_remote: number; error: string | null;
}
export function filmProgress(run: FilmRun, tasks: FilmTask[]) {
 const render = tasks.filter(t => t.run_id === run.id && t.kind !== "ASSEMBLY");
 const done = render.filter(t => t.status === "DONE");
 return { tasks: render.length, done: done.length,
  renderedSeconds: done.reduce((n,t) => n+t.frames,0)/run.fps,
  seconds: run.frames/run.fps,
  percent: Math.min(100, Math.round(done.reduce((n,t) => n+t.frames,0)/run.frames*100)),
  errors: render.filter(t => t.status === "FAILED" || t.status === "BLOCKED").length,
  approved: run.status === "RELEASED" && run.quality_report.production_approved === true };
}
