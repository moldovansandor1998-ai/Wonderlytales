# WonderlyTales continuation — 2026-10-10 16:44 UTC

Last verified successful GitHub commit: `868f6f0156616ce334baa6a67411a9bef68f0b69`.
The commit containing this checkpoint is the next successful checkpoint; resolve HEAD.

## Completed / preserved
- Recovered main from `4dccf23`; no later saved dialogue fix existed.
- First continuation deployed READY: `dpl_DaK3PRnahS6X8hp5k6TxqpZbM8wc`.
- Supabase healthy: 3 REVIEW runs, 10 DONE tasks, fresh durable scheduler heartbeat.
  RunPod initially 21 completed / 0 failed / 0 active. No new GPU jobs submitted.
- Durable render/restart/R2/assembly infrastructure and immutable V022 sources preserved.
- 132 current MP3s decoded, all scene/episode/character/selected-voice paths checked.
  132 matching hash+script recognition caches now persisted in R2 (126 newly audited).
- 112 recordings have valid measured Hungarian grapheme timing; 20 require review.
  Evidence: ops/current-speech-audit-20261010.json and speech-review-required-20261010.json.
- 112 viseme tracks + manifest uploaded and byte-verified at
  `audio/S1E1/verified_v023/` in R2. Git manifest: ops/speech-v023-manifest.json.
  No phonetic/acting approval: transcript matches and measured character timing only.
- Ownership/hash checks protect audio/alignment routes; cached approvals recomputed.
  Measured multigraph groups accept zero-length component letters only when the
  whole Hungarian grapheme has a positive measured duration; no invented timing.
- Supabase adapter now reads beyond the 1000-row cap. Test covers 2400 lines/400 scenes
  with a 500-row server cap. IDs must advance; incomplete/error pages fail visibly.
- Live 300-scene / 60-minute FEATURE enqueue test PASSED in 53.483 ms: 300 render
  tasks, 1 assembly task, 86400 continuous frames, retry idempotency and HELD gate.
  Transaction rolled back; DB remained 3 runs / 10 tasks. No GPU/media render claimed.
- Reusable pelvis and sole heading transitions now blend at clip boundaries.
  Pure animation tests: 21 passed. TypeScript check passed. Web suite: 135/136 passed; shared demo artifacts caused a corrupted MP4.
  Re-run of the unchanged demo in /tmp/wonderly-demo-qc passed HU+EN assembly;
  use an isolated working directory for media tests.

## In progress
Native V023 candidate authoring and comparison on separate temporary Blender 5.0.1
sandbox. Production worker uses 4.5.3: compatibility is NOT yet verified; do not
replace V022 masters or promote the Blender 5 candidate to the production worker.

## Measured open defects
81-frame native V022 sample (not exhaustive full-frame QA), stored in
ops/native-baseline-v022-20261010.json:
- Lili: 7.25 cm foot-target error; 19.03x skin-edge stretch, tail weight discontinuity.
- Potty: 660.20 deg/s knee at frame 721; 22.36x ear/skin transition stretch.
- Zizi: 11 inverted sampled outer-mouth triangles; 7.00x mouth edge stretch.
- Mark: seam measured <0.000001 m; preserve this successful V022 repair.
Other mouth seams, natural acting and final film lighting remain unapproved.
The existing screenplay is ~22 minutes, not a finished 40–60-minute feature.

## Next operation
Complete native candidate QC, persist its measured results and reversible source
scripts. Then continue the Csodakapu 60-minute script and scene preparation without
starting a full FEATURE render. The 20 flagged speech recordings need adjudication.

## Background / budget
Daily cap unchanged: $200 Asia/Saigon. At 16:42 UTC ledger reservation $121,
remaining $79 (reservation ceilings, not actual vendor charges). No new TTS.
Temporary Vercel sandbox: `sbx_vosK0I0W2XnUyS41uDJZxAfaXOp4`, 4 vCPU,
nonpersistent, 50-minute total timeout; stop when artifacts are saved.
Authoring reservation `4bed006d-1b79-4888-a3eb-8a8bfb1b1cd8`: $2.
Candidate command: `cmd_6114236254ec4bd6bd8c80b05363`.
Local official Blender 4.5.3 hash verified but exits SIGBUS; Ubuntu official
Blender 5.0.1 runs in sandbox. No costly full-film production approved.
