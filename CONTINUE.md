# WonderlyTales continuation — 2026-10-10 18:11 UTC

Last successful Git commit: `1885eb30cf0de66076ec2961baf77616dae7a2c2`.
This checkpoint follows it; `git log -1` gives this document's commit.

## New completed work
- Production Blender 4.5.3: complete 1440-frame continuous-binding/support QA.
  Lili worst body edge stretch now 3.718x (previous gait candidate 6.048x),
  Potty 2.504x, Zizi 2.361x. Lili maximum foot error 0.0226 mm.
  No production approval: knee peaks remain Lili 777.68 / Potty 506.13 deg/s.
- Anatomy-scaled, zero-endpoint-velocity swing lift replaces excessive fixed
  lift on short limbs. Planted positions and native geometry preserved.
- Separate MASTER_CAST_V024b, SHA256
  3d664f433434a034451301f2b0d4a86537f76e8cf36f57af2d011737c6ccb185,
  saved with source/report/registry under R2 native/S1E1/V024/. V022 intact.
- First actual new GPU test COMPLETED: job
  cc597d9e-807a-4bb3-9702-6567d4a0283d-u2, 144 frames / 6 seconds,
  1920x1080 / 24fps / 48 samples / RTX PRO 6000 Blackwell OPTIX,
  scene audio present. Execution 324.172 s. Downloaded clip SHA verified:
  6dbb7085f7f986d016d7596dbb96de99c3586c58a3eb05434a0433b0be9ff823.
  This is a studio gait diagnostic, not a connected cinematic quality sample.
  Full immutable storage key is in ops/v024-gpu-gait-result.json.
- Independent no-prompt medium Whisper review completed for all 20 flagged
  originals: 7 normalized transcript matches, 13 remaining differences.
  This is recognizer evidence, not phonetic, listening or acting approval.
  No recordings/voices replaced. No new ElevenLabs generation.
- 79.167-second listening comparison reel made from the 20 originals, with
  script/Scribe/independent text and speaker IDs. Hash and manifest saved in
  ops/audio-review-reel-v024.json; R2 audio/S1E1/review/V024/.
- FEATURE_V002 original 40 units / 244 lines retained. First two story units
  staged as 132 seconds / 35 shots / 3168 frames / 9 bounded render jobs.
  Source scripts/storyboard/render plan saved in quality_opening_V024/.
  19 unchanged recordings; 16 measured tracks; 3 unresolved takes explicitly
  flagged and staged offscreen, not approved. 113 new lines still unrecorded.
- Reusable camera dolly, prop carry-through, crouch and offscreen-audio mixing
  added. 25 pure animation tests pass; Python modules compile.

## In progress / exact next operation
- Native compilation of the two forest scenes is RUNNING in sandbox
  sbx_hbrj4u6r1FOrgWWTiIRBSZUkGJFS; log /vercel/sandbox/opening_build.log.
  Files /vercel/sandbox/opening/S1E1_SC001_V024.* and SC003 counterpart.
  Pipeline: compile -> support bake -> real original HU mix -> native props
  and packed audio. Existing story prop geometry reused.
- Read log, fix any errors, inspect representative native forest frames and
  hand/prop continuity before submitting bounded GPU scene jobs.
- Preserve final blends, full QA and audio mixes to R2, freeze checksums in
  the job manifest, then prove actual multi-scene GPU rendering and assembly.
- Native sources/reports already persisted: continuous.blend, V024b master,
  registry, full QA, earlier rejected experiments. Local paths data/V024/.
- Remaining defects: Lili/Potty knee velocity, visual skin/contact approval,
  Zizi mouth seam, natural gaze/acting, Morzsi/Bogyo movement QA, 20 auditory
  adjudications, 113 new readings, full-feature dramatic timing/storyboard.
  Feature measured duration remains NULL; 60 minutes is not yet demonstrated.
  Reference film unavailable to inspect; no reference-quality claim.

## Background / budget
- Authoring sandbox timeout extended to 90 minutes total, until ~18:55 UTC.
  4 vCPU / 8 GB, nonpersistent. Persist files and stop when finished.
- Current budget day 2026-10-11 Asia/Saigon: $6.50 reserved so far:
  authoring e00f3614-3d1c-4c65-8ac0-8609350a9b5b and
  bd226f3b-f215-4b04-b991-e142f86e0dc5 ($2 each), GPU
  2e7d4366-b5f1-418a-a1df-60e10a450d00 ($2.50).
  Limit unchanged $200. Reservations are ceilings, not verified vendor bills.
- Existing durable Supabase runs and 300-scene transactional queue test intact.
  First GPU diagnostic submitted directly, not claimed as queue scale proof.
- No full 60-minute render, no new TTS, no accepted V016 rerender.

---
## Earlier checkpoint context (superseded above)

# WonderlyTales continuation — V024 / 2026-10-10 17:38 UTC

Last successful saved checkpoint: `1c8cbb902676d15638426a2948978855776f072a`.
This development checkpoint follows it; `git log -1` identifies its own commit.

## Current verified development
- Read the latest GitHub CONTINUE first; main matched 1c8cbb9 and was clean.
- Live Supabase: 3 REVIEW runs / 10 DONE tasks. RunPod: 21 completed,
  zero failed/active/queued. Existing renderer, storage, jobs and V022 preserved.
- Official checksum-verified Blender **4.5.3 LTS** now runs successfully in the
  authoring sandbox. Version hash 67807e1800cc. The existing downloaded official
  archive was reused through R2, solving the local SIGBUS/runtime mismatch.
- Native 4.5.3 V022 baseline matches the prior 5.0.1 geometry measurements.
- Continuous anatomical skin envelopes replace discontinuous inherited tail/ear
  masses on Lili, Potty, Zizi. Coordinates, shape keys and Mark binding unchanged.
  Candidate only; no master promotion. Both segment and attachment profiles kept.
- Matched 81-frame binding comparison: Lili body stretch 19.03x -> 5.11x,
  Potty 22.36x -> 2.76x, Zizi 14.39x -> 3.07x; Lili foot error 3.36 mm.
  Attachment-envelope refinement: 4.62x / 2.49x / 2.38x respectively.
- New all-frame QA distinguishes partial from complete results. First complete
  1440-frame run found missed defects: Lili foot error 17.91 mm, knee peak
  1181.52 deg/s; Potty knee 1191.12 deg/s. Sparse QA is insufficient.
- Native sources and measurements saved under R2 `native/S1E1/V024/`.
  Initial binding source SHA256: 3a179b0179e52961ff4420941930d10fb1a640df05aff429d51eb2b9c8b06e34.
  Reports: ops/v024-*.json. Small closeups in R2 are diagnostic; some targets
  were occluded, so new isolated closeups are rendering.
- Existing 22 pure animation tests pass. No new TTS, no GPU renders submitted.

## Running work / exact next actions
1. `bake_native_support.py` applied a 4% leg bend reserve on all 1440 frames:
   Mark 1307, Lili 1421, Potty 1343, Zizi 1428 corrections, zero rejected frames.
   Independent full-frame QA RUNNING, file `reachable_all_frames_453.json` in
   sandbox. Do not approve until complete and visually checked.
2. Inspect isolated closeups at `closeups_reachable/`, then preserve reachable
   .blend, complete QA and support report to R2. Investigate remaining skin,
   knee, mouth seam and body-contact defects. Morzsi/Bogyo motion still pending.
3. Independent Hungarian recognition script prepared for the 20 flagged takes,
   no script prompt. Medium Whisper model pinned to 8701f851d407f3f47e091bb13b8dac5290c7f7fb.
   Local runtime needs model vocabulary.txt download; no recognition approved yet.
4. FEATURE_V002 unchanged: 40 units / 244 lines / 113 unrecorded new lines.
   Actual duration still NULL. Storyboard, measured reading and animatic remain.
5. Only after native inspection, make a bounded connected GPU quality sample
   with real audio/mix/assembly. No full feature render or release approval.

## Background / budget
- Active temporary authoring sandbox: sbx_hbrj4u6r1FOrgWWTiIRBSZUkGJFS
  name wonderly-v024-binding-20261010, 4 vCPU / 8 GB, nonpersistent,
  started ~17:25 UTC, 45-minute timeout. Persist artifacts before stopping.
- Authoring reservation e00f3614-3d1c-4c65-8ac0-8609350a9b5b: $2,
  day 2026-10-11 Asia/Saigon; limit unchanged $200. Reservation != vendor bill.
- Local ASR setup in tools/speech-audit-venv; no paid recognition or new voice.
- R2 originals V022, rejected V023 experiments, accepted voices and V016 intro
  remain unchanged. No old finished media rerendered.

---
## Previous complete checkpoint (retained context)

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
