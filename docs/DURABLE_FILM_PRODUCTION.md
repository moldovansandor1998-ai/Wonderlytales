# Durable film production — live checkpoint, 2026-10-10

## Independently operating services

Supabase project `vruxiyvlynbivzjuijed` hosts film_runs, film_tasks, film_events,
film_control_status and the private controller. The pg_cron job
`wonderly-film-queue` invokes film_private.tick() every minute. Successful cron
runs and heartbeats were measured in Postgres. Neither Work, a browser nor a
Vercel request is needed to dispatch, poll, retry or finish existing jobs.

RunPod endpoint `cfog2x4xsd0adz`, Wonderly Tales Native Blender Blackwell, now
runs the native worker image built from commit
`e3cb4348e93116c5cf56c3c9c9fa8b6a3cd2e8da`. Build Completed was observed in the
console. WORKER_RENDERER_REVISION matches that immutable worker version.
Hardware was directly verified: NVIDIA RTX PRO 6000 Blackwell Server Edition,
OPTIX. There are zero always-active workers, at most one flex worker, one GPU
per worker, a 5-second idle timeout and a 1,800-second execution timeout.
A worker starts for queued work and scales down afterward. It does not need Work.

The existing credential is stored in Supabase Vault as wonderly_film_runpod.
Endpoint verification and dispatch are enabled. Only ACTIVE qualified runs can
submit. Currently all development runs are REVIEW, so no feature is running.
The authenticated Studio /production page shows durations, scene counts, progress,
provider ids, errors, QC reports and signed video links. The browser refresh timer
only displays state; it performs no production work.

## Durable execution and limits

The controller saves submission intent and a budget reservation before HTTP. It
keeps provider job ids and retries lost polls without submitting another job.
An ambiguous submission is BLOCKED for reconciliation, never blindly duplicated.
Confirmed failed/cancelled/timed-out attempts receive bounded exponential retry.
DONE tasks are never selected again. Pausing stops new submissions and preserves
polling for existing jobs. pg_net transport loss does not erase logged task state.

Each native PNG is immediately uploaded to R2 with a SHA-256 metadata field. A new
worker restores only verified frames matching source, range, settings and worker
revision. It skips restored frames. Sources and videos remain in the existing
project bucket. Clip generation checks frame count, fps, dimensions and full decode.
The assembly task freezes ordered clip hashes and the complete Hungarian mix,
checks every clip and audio duration, stream-copies video into a master, verifies
and uploads that master. It finishes to REVIEW, never automatic artistic approval.

The existing daily budget remains $200 in Asia/Saigon. Observed selected GPU rate
is $3.49/hour. Each dispatch reserves $2.50 conservatively; a 1,800-second execution
alone is approximately $1.745, before start/idle/storage costs. This reservation
is not a provider-enforced price guarantee. Requests explicitly carry a
1,800,000-ms execution policy and 3,600,000-ms TTL. No balance top-up, new payment
method, auto-refill or budget increase was performed. The console balance changed
from $43.76 to $43.65 during verification; this is an observed balance difference,
not a settled or endpoint-attributed invoice. Reservations remain conservative.

Provider asynchronous results have limited retention. A prolonged database outage
past provider retention can require reconciliation against R2; it is not proven
as automatic disaster recovery. More simultaneous workers, hours-long full-film
assembly, storage sizing, hundreds-scene GPU stress and provider outage recovery
still require validation. Do not infer those from the small live test.

## Real GPU interruption and assembly evidence

Run `7c3cd73e-f5ac-4931-82b4-117a80360e95` was submitted by the database controller:
48 native frames, 1920x1080, 24 fps, 48 Cycles samples. This is a system test using
known V021 diagnostic source, not a new artistic trial or a feature.

First provider job `640ca51f-286b-4ca2-9732-491c1db23646-e1` on worker
`9ketpnbc6si3rz` was deliberately cancelled after checkpoints were observed.
The controller detected CANCELLED, preserved the payload, waited its backoff and
submitted attempt 2 automatically. Job
`1e5ab229-b202-4fee-9be1-3361ecb2d8dc-e1` ran on a DIFFERENT worker,
`e1747pvdwkxpj4`: 42 frames were restored and only 6 rendered. It returned the
exact configured worker revision and verified output. The DB accepted it as DONE,
then automatically submitted assembly job
`f2378509-4052-4e9d-842e-8a3074b92e79-e2`. Both tasks became DONE and the run REVIEW.
The full-mix master was downloaded independently, its SHA matched, and all 48
frames and AAC audio decoded. Evidence: ops/native-worker-live-evidence.json.
No completion was inferred from submission alone.

## Latest source and quality status

The newer V022 source commit `d8ec1d1dbf8689e78eeab6b11cd0ce6fec6bd2aa` was
reconciled into this branch, retaining our infrastructure. It adds portable render
cache checks and per-character mouth attribution. Existing V021 and V022 work is
preserved. No approved intro, story, master or voice is replaced.

The V022 master hash is
`5d0c6e25acbf5597e63e88dcfb82d948a779018de256d55207863de00148ea64`;
the 60-second scene hash is
`e5df53e3fdc954d0020cfa065b5dd7bc00d045b47b248bbb289054c5cf399fae`.
Recovered V022 master, native scene, full video and four completed clips were
uploaded, downloaded and SHA-verified. The existing full V022 video and all four
clips were fully decoded again. Studio run
`8caf0f3c-a0b0-49e5-b7f8-0e0137315c16` shows REVIEW, 4/4 DONE and no approval.
ops/V022-storage-evidence.json and ops/imported-V022-checkpoint.sql reproduce this
checkpoint. The older V021 checkpoint is also preserved, without rerendering.

V022 supplied native QC measures Mark's 150-pair mouth seam across 81 poses:
maximum gap 4.98966445e-7 m, no measured flipped outer triangles. The 30-second
review checks all 720 frames; that outer seam passed. This is not proof of all
inner-mouth intersections, good sculpt, phonetic accuracy or natural acting.
The latest multi-character scene still fails: Lili foot-target error reaches
7.69 cm, whole-scene skin edge stretch reaches 22.60x, Potty's left knee jumps
660.20 degrees/second at 720->721, and Zizi's final section has 79 flipped outer
mouth triangles and 6.998x edge stretch. Their seams remain unverified. Mark's
inner mouth/teeth/eyes, all remaining faces, gait and interaction need work.
The GL review and 12-sample diagnostic face images are not final cinema lighting.
The source hashes match these supplied measurements; native QC was NOT rerun in
this Work container. The official local Blender installation could not execute
reliably (SIGBUS); no local success is claimed. The deployed remote renderer did
execute and pass the real media/system test above.

## Feature contract and unfinished work

POST /api/production/enqueue accepts a frozen episode manifest, title and mode;
Studio authorization is required. The RPC validates Full HD+ jobs, 1–360 frames
per job, contiguous episode coverage, source SHA, renderer revision and samples.
FEATURE requires >=57,600 frames (40 minutes) and the full Hungarian dialogue,
music and SFX mix. The episode default is 86,400 frames (60 minutes). Enqueue is
HELD. Client production_approved is forcibly false. FEATURE cannot resume until
quality approval is provided by the trusted review process. Rendering alone
cannot release a film. The approximately 21-minute story draft still needs real
authored expansion; padding is forbidden.

Validation: 125 web tests, 19 animation-system tests, 4 native checkpoint/real
FFmpeg assembly tests, TypeScript and the preceding production build. Live SQL
rollback tests passed after configuring the existing Vault credential; the lost
poll fixture now includes a valid dummy endpoint. Rollback prevents any fixture
HTTP request reaching the provider. Live restart and assembly evidence above is
additional to these tests. Full 40–60-minute cinematic generation remains
unapproved and unproven. Next: actual character repairs and remeasured QC,
Hungarian phonetic/acting review, production locations/lights/effects/mix,
feature-length authored scenes, and full-length resource/stress validation.
