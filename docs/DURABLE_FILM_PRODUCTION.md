# Durable film production — 2026-10-10

Continues `work/v022-facial-continuity` at `b454650bd5a1e3a23295ef78161474e936b4ce30`.
No character masters are replaced by this infrastructure change.

## What operates without ChatGPT Work

The existing Supabase project hosts `film_runs`, `film_tasks`, `film_events` and
`film_control_status`. `wonderly-film-queue` runs `film_private.tick()` every minute
through pg_cron. Heartbeats and successful executions are measured in Postgres.
This scheduler does not require a browser, a Vercel request or a Work process.

It persists submission intent before HTTP, reservations before paid dispatch,
external job id, endpoint, retry count, backoff, output hash and event history.
pg_net's transport is unlogged; a lost transport request is recovered using these
logged records. Polling resumes the existing provider id. Unknown submission
outcomes are BLOCKED for reconciliation, never blindly retried. An exhausted
bounded retry fails the run. Pausing stops new submissions and keeps polling
already submitted work. Completed tasks are excluded from dispatch.

The controller is LIVE, but paid dispatch is DISABLED. There is no verified native
endpoint in `film_private.config` and no `native_render` per-attempt ceiling in
the existing budget policy. The existing daily policy is $200, Asia/Saigon; this
change does not increase it or equate the internal ledger with a provider cap.
Existing RunPod CPU-preview and character-authoring endpoints are reachable and
have zero active jobs. Their readiness does not establish native movie capacity.

## Deployed application contract

`/production` shows actual duration, scene count, rendered task progress, scheduler
heartbeat, provider ids, failures, QC evidence and an authenticated video link.
The page refreshes when visible; this timer does not perform film production.
`POST /api/production/enqueue` accepts a frozen manifest with episode id, title,
DIAGNOSTIC/FEATURE mode and quality evidence. RPCs enforce Studio authorization;
the browser has read-only table access. Client-supplied production approval is
always reset to false. Enqueue starts HELD, never paid automatic production.

Manifest: fps=24, frames, jobs[]; each job has operation=RENDER_NATIVE_FRAMES,
scene_id, scene_key under native/S1E1, source SHA-256, renderer_revision (40-character
deployed git revision), inclusive frame_start/frame_end, episode_start_frame,
width/height (Full HD or greater) and samples (48–512). Each task is 1–360 frames;
episode coverage must be consecutive with no gaps. FEATURE requires >=57,600
frames (40 minutes). The existing episode default is 86,400 frames (60 minutes).
Long-film fixtures verify scheduling, not artistic content or a finished film.

For film assembly, audio_key under audio/S1E1 and audio_sha256 freeze the complete
48 kHz Hungarian dialogue/music/SFX mix. FEATURE requires a full mix. An ASSEMBLY
task waits for all render clips, then freezes their ordered hashes. It validates
and decodes each clip, matches dimensions/fps, checks full audio duration,
assembles and decodes the complete master, and uploads a content-addressed video.
This media result still requires artistic/phonetic/cinematic review.

## Native worker code: implemented, NOT live-validated

`worker/Dockerfile.native-gpu` includes native scene rendering, R2 checkpoints and
FFmpeg assembly. Set WORKER_RENDERER_REVISION to the deployed source commit; an
input claiming a different version fails. The current hardware contract is RTX
PRO 6000 OPTIX, Blender 4.5.3, 24 fps, Cycles. R2 source checksums are verified.
Each rendered PNG is immediately uploaded with a SHA-256 metadata field. A fresh
worker retrieves only hash-valid checkpoints under the exact scene/range/render
settings/revision namespace. Already rendered frames are skipped. A failed job
does not discard completed frames. A final clip is counted and fully decoded.

No image was built/deployed in this turn and no native GPU work was submitted.
RunPod GraphQL administration returned HTTP 403 (error code 1010); its browser
console requires sign-in. The native endpoint must be provisioned/updated and
smoke-tested before config.endpoint_verified/dispatch_enabled can be enabled.
Establish a timeout/hardware-based worst-case per-job price and provider billing
limits before adding native_render to budget_policy.service_ceilings. Do not
invent or increase a budget to unblock work. Store the existing RunPod credential
in Supabase Vault as wonderly_film_runpod; it is deliberately absent from git.

## Preserved completed test

The V021 60-second test and its four 360-frame clips were fully decoded again,
uploaded into the existing R2 bucket, downloaded and SHA-256 verified. The native
source and full Hungarian development mix were also persisted and read-verified.
`ops/V021-storage-evidence.json` contains keys/checksums/sizes, no credentials.
`ops/imported-V021-checkpoint.sql` reproduces the import without new rendering.
The run is REVIEW with 4/4 DONE and production_approved=false. GL review footage
is explicitly labeled; it is never passed off as a final Cycles movie.

V021 has measured facial boundary failures, stretched/inverted mouth geometry,
body distortion, foot contacts/sliding and a discontinuity at a clip boundary.
V022 source contains newer mouth repair work, but the preserved V021 movie is not
represented as a V022 result. No new V022 native animation verification was
possible here because Blender is not installed in this Work environment.
The Csodakapu feature is HELD until actual animation quality tests pass. The
existing approximately 21-minute script still needs authored expansion; no
padding is performed.

## Validation

125 web tests, TypeScript, production build, 18 animation-system unit tests;
checkpoint tests use a new temporary container directory and reject corruption;
real FFmpeg assembly checks clip ordering, full length and audio hash mismatch.
`ops/test-durable-film-queue.sql` tests the live DB in a rollback-only transaction:
idempotency, mode separation, short-feature rejection, self-approval prevention,
ambiguous submission, lost polling, no duplicate attempt, completed-to-REVIEW and
viewer denial. No provider submission is made by this test.

Remaining: live native endpoint deployment, finite cost-ceiling verification,
GPU stress/restart test, all character facial/body fixes, phonetic and artistic
review, final cinema lighting/location/contact work and full feature validation.
Infrastructure code and successful unit tests alone do not complete those tasks.
