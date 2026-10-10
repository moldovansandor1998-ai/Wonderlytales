# WonderlyTales continuation — 2026-10-10 17:06 UTC

Last verified successful development commit: `4266970498f2f4c5dc423f1de1a27ef58dbbfbaf`.
This file-only continuation update follows it. Use `git log -1` for the checkpoint-document commit.

## Completed / preserved
- Recovered main from `4dccf23`; no later saved dialogue fix existed.
- Latest web continuation deployed READY: `dpl_9ge5GhBLus9UMLkZ1N4zWy6ywUjj`.
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
  Pure animation tests: 22 passed. TypeScript check passed. Web suite: 135/136 passed; shared demo artifacts caused a corrupted MP4.
  Re-run of the unchanged demo in /tmp/wonderly-demo-qc passed HU+EN assembly;
  use an isolated working directory for media tests.

## Completed native / screenplay checkpoint
- All SIX V022 rigs passed native structural/independent jaw-eye-blink-viseme tests
  under Blender 5.0.1; 78 Action assets retained. Morzsi/Bogyó motion is NOT verified
  by the four-character 60-second scene. See ops/master-structure-v022-20261010.json.
- Separate V023 motion, skin experiment and body-support candidates persisted in R2
  under `native/S1E1/V023/`; originals untouched. Diagnostics are NOT promoted masters.
- Matched 81-frame comparison: Potty peak sampled knee speed 660.20 -> 362.67 deg/s;
  Zizi outer-mouth inverted triangles 11 -> 0; Mark seam continuity retained.
- Lili's support candidate foot error 0.07253 -> 0.00336 m, BUT body stretch
  19.03x -> 27.86x. Candidate REJECTED for promotion. Broad weight diffusion also
  regressed skin and is disabled in repair_motion_transitions.py.
- Small 640x360 / 8-sample native Cycles proof rendered and visually inspected:
  `native/S1E1/V023/diagnostic_motion_frame_721.png`. Four-character diagnostic
  studio floor, noisy sampling, NOT a finished cinematic environment/film.
- New complete feature script draft: production/episodes/S1E1/feature_V002/.
  40 editorial units, 20 new scenes, 244 dialogue lines; 131 exact current story
  recordings reused, 113 new lines unrecorded. Separate existing end-card CTA kept
  outside story. Accepted 15-second V016 intro preserved before the story.
  Planned 3600 seconds; actual duration NULL, no measured animatic or render approval.

## In progress / open blockers
- 20 current recordings still need transcript/language/timing adjudication. No new TTS.
- Lili skin/hip/neck/tail binding must be corrected together with reachable support.
  Potty ear/head transition, Zizi body/tail deformation and five unmatched mouth seams
  remain. Do not approve from passing foot or outer-mouth checks alone.
- Blender 5.0.1 candidates are NOT verified for production Blender 4.5.3 compatibility.
- Shot blocking, natural acting, full-frame/contact tests, production environments,
  lighting, music/SFX, reading pass and measured 60-minute animatic remain unfinished.
- Reference YouTube film could not be retrieved; no claim of matching its quality.

## Next exact operations
1. Start from V022 frozen master/scene hashes in the native baseline report. Inspect
   Lili's worst skin edges and body-parent chain using ops/native-support-v023-20261010.json.
   Repair the bind gradients before enabling fit_native_support in scene compilation.
2. Re-run identical native QA plus all-frame sole contacts/skin/joint checks. Compare
   all metrics; preserve Mark's measured seam. Verify with production Blender 4.5.3.
3. Read the feature V002 full Hungarian draft and dialogue sheet; storyboard/measure
   the 20 additions before recording 113 new lines. Do not stretch holds to reach 60m.
4. Review the 20 flagged existing utterances; preserve cache hashes and accepted audio.
5. Only then render another bounded multi-character quality gate; no full FEATURE run.

## Background / budget
Daily cap unchanged: $200 Asia/Saigon. The 2026-10-10 Asia/Saigon day closed with $121 reserved.
At 17:07 UTC the local budget day became 2026-10-11: $0 reserved / $200 remaining.
These are reservation ceilings, not actual vendor billing. No new TTS.
Temporary Vercel sandbox: `sbx_vosK0I0W2XnUyS41uDJZxAfaXOp4`, 4 vCPU,
nonpersistent, 50-minute total timeout; stop when artifacts are saved.
Authoring reservation `4bed006d-1b79-4888-a3eb-8a8bfb1b1cd8`: $2.
Native jobs finished; sandbox STOPPED after R2 persistence and hash verification.
Support candidate SHA-256 verified after a full R2 read:
`68185d7afceb3a55d01ed559c2208518c699b7f75354910ab4c015bb744e894d`.
Live cached audio recheck FINISHED: 132/132, 20 review required, zero new recognitions.
Evidence screenshot: ops/proofs/studio-speech-audit-20261010.jpg.
No task from this continuation remains running in a browser or sandbox.
Local official Blender 4.5.3 hash verified but exits SIGBUS; Ubuntu official
Blender 5.0.1 runs in sandbox. No costly full-film production approved.
