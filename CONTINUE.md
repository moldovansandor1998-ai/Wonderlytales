# WonderlyTales continuation — 2026-10-10

Last verified successful remote commit: `4dccf23fb056e9d4cc0a5c71addd9a06f318818a`.

## Completed / preserved
- Recovered the latest main and all remote branches; no later saved speech fix exists.
- Live Supabase is ACTIVE_HEALTHY. Scheduler heartbeat current, dispatch enabled,
  10/10 tasks DONE, three runs REVIEW, zero active remote jobs.
- Direct RunPod health: 21 completed, zero failed/in progress/in queue. No new jobs submitted.
- Vercel production deployment `dpl_6775FX6VfE6sUqBJ4XRSexRpZrCW` READY.
- All 132 Hungarian dialogue rows have matching episode/scene/character links and
  consistent sequence fields. The one shared audio path is the same character/text.
- V022 master and scene still exist in R2. Durable queue/worker left unchanged.

## Completed in this checkpoint
- All 132 current MP3s downloaded and fully decoded; all voice path/character links match.
- Audit: only 6 current audio hashes have cached reviews; 126 need current-recording
  recognition. Strict validation accepts 1 of the 6 for orthographic lip-sync.
  The other five require timing/language review. Evidence: ops/current-speech-audit-20261010.json.
- Added recording ownership checks to audio/alignment routes and speech actions.
- Revalidate cached transcript/language/character coverage, overlaps and audio hash.
  Keep the cache key revision to avoid unnecessary paid recognition.
- Hungarian multigraph/doubled-multigraph grouping, source identity, complete measured
  text validation and within-word gap handling added to native lip-sync.
- Added bounded/resumable current-recording audit button (no voice regeneration).
- 133 web tests and 19 animation tests passed; TypeScript passed.

## In progress
Build/deploy this checkpoint, then run the current-recording audit in authenticated
Studio. Character animation and feature-length validation follow.

## Known open problems
V022 Lili reach/skin distortion, Potty knee jump, Zizi flipped mouth triangles;
other facial boundaries and acting unapproved. Existing screenplay is about 21
minutes, not a finished 40–60 minute film. No new visual quality approval.

## Next operation
Finish the speech/cache regression tests, save audit evidence, commit and push.
Then repair reusable motion transitions and validate hundreds-scene scheduling.

## Background / budget
No new paid calls or render jobs launched in this continuation. Daily cap remains
$200 Asia/Saigon. FEATURE remains gated. Never run the costly full film until QC passes.
Local Blender 4.5.3 official archive SHA verified but exits SIGBUS (135) before startup.
Temporary Vercel native-QC sandbox: sbx_vosK0I0W2XnUyS41uDJZxAfaXOp4;
4 vCPU, 20-minute timeout, nonpersistent. Stop it when done. Authoring reservation
4bed006d-1b79-4888-a3eb-8a8bfb1b1cd8: $2. Prior daily reservations $87.75.
Local temporary downloads/checks are not independent durable rendering jobs.
