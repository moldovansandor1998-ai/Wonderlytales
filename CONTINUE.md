# WonderlyTales — continuation checkpoint

Last successful Git commit: `7dde68130b1b47e042620304b024332c6ceb9b8a`.
The commit containing this document follows it (`git log -1`).
Do not rebuild infrastructure or modify V022/V023 originals. Daily ceiling $200.
User's earlier verified base: 4266970498f2f4c5dc423f1de1a27ef58dbbfbaf.

## Immediate running state / next action
- NINE existing RunPod native GPU jobs cover TWO connected opening scenes:
  SC001 58 s / 1392 frames, SC003 74 s / 1776 frames. Total 132 s / 3168.
  Two clips (720 frames / 30 s) are verified completed at this checkpoint.
  One worker executes the remainder; do not resubmit queued/completed jobs.
- Live manifest: `ops/v024-opening-render-jobs.json`; durable R2 copy:
  `native/S1E1/V024/checkpoints/opening_render_jobs.json`.
- Local watcher RUNNING: `scripts/watch-opening-review.py`, exec session 99788;
  log `/workspace/scratch/0cbf6b31fe03/private/opening-watch.log`.
  It polls safely, assembles ONLY after all 9 verified clips complete, then
  downloads and fully decodes the 132-second movie. No approval is inferred.
  Resume with authorized credentials. Avoid concurrent manifest writers.
- Full original-HU review mix prepared: 132 s, 48 kHz stereo PCM16, SHA
  c5ef49ad4a17959dc6c35d40a1c522d83fe13f112e667027d810bc73b00c9a4d.
  R2 `audio/S1E1/review/V024/WonderlyTales_V024_opening_132s.wav`.
  `ops/v024-opening-assembly.json` holds future assembly state and reservation.
- Native Blender authoring sandbox: sbx_hbrj4u6r1FOrgWWTiIRBSZUkGJFS,
  expires ~20:25 UTC. 4 vCPU/8 GB, official Blender 4.5.3 LTS hash 67807e1800cc.
  Current command cmd_69355a038c6247ca9ee26bff3e37 renders all-six 20-second
  CPU motion diagnostic, log /vercel/sandbox/cast_preview_resume2.log.
  Output cast_preview/WonderlyTales_V024_all6_motion_20s.mp4, 768x432, 4 samples.
  This is NOT the production GPU quality sample. Valid PNGs resume without
  rerendering. IMPORTANT: use `exec blender ...` inside shell wrappers so a
  command termination does not orphan Blender. Old preview PIDs stopped.
- Preserve preview movie/manifest in R2 before stopping sandbox. All successful
  .blend masters and full QA listed below already persisted to R2.

## Completed character work, independently measured on Blender 4.5.3
- Lili/Potty/Zizi continuous anatomical skin binding, anatomy-scaled foot lift,
  planted quadruped turn steps and reachable pelvis bake implemented reusable.
  V022/V023 and earlier failed experiments kept. No identity replacement.
- Full 1440-frame gate test: Lili foot max error 0.0226 mm; worst body stretch
  3.718x versus V022 19.03x. Potty 2.504x, Zizi 2.361x. Naturalness unapproved.
- Missing biped hand IK influence drivers restored and native-tested for all 6.
- Bogyó body binding repaired: 480-frame diagnostic worst stretch 73.740x ->
  3.479x. Separate oral head/jaw binding reduces mouth flips 2786 -> 0 and
  outer edge ratio 33.25x -> 1.003x. Facial seam correspondence still missing.
- New temporal pelvis support smoothing preserves fixed feet/reach. Same
  480-frame all-six test: knee maxima Lili 927.73 -> 750.09 deg/s, Pötty
  624.96 -> 490.00, Bogyó 922.47 -> 736.07. Still not natural-motion approval.
  All feet under 0.051 mm; full QA in ops/v024-CAST_MOTION_V024_smooth.qa.json.
- Reusable MASTER_CAST_V024d.blend SHA
  a6bb2825f4476bf86542a04c7b1f77c5738d47754593f18175e8b3d68c26cb8f.
  All-six native structure, eye/blink/jaw/viseme/hand driver checks PASS.
  Registry, binding and structure reports R2 native/S1E1/V024/ beside master.
- All-six smoothed diagnostic source SHA
  2df8761ead515c61b57f472e89a43e217683b146a29e79794beb65311df41bc9,
  R2 native/S1E1/V024/CAST_MOTION_V024_smooth.blend, with full QA/support.

## Frozen connected opening / exact production inputs
- SC001: native/S1E1/V024/opening_final/S1E1_SC001_V024.blend
  SHA 7ad6efdef7e624202cfb0f67772f5386a69b71ecf30f93ca86fafd63fccd4d79.
  All 1392 native QA frames complete; no unreachable turn frames remain.
- SC003: native/S1E1/V024/opening_contact_v2/S1E1_SC003_V024.blend
  SHA bb383b0350bd9f20219196b270d40b15e8e867d7d43817f229da8f6c18025d4b.
  All 1776 QA frames complete, hand contact 2.596 mm, Mark body stretch 4.167x.
  Crouch 0.24 local, forward knee calibration, explicit linear skinning.
  Native grasp proof checked. Finger articulation not yet approved.
- REJECTED: old opening_final/SC003 (416.87x skin spikes despite hand contact)
  and opening_contact_final/SC003 (22 mm hand gap). Neither submitted to GPU.
- Existing forest and story props reused, 35 camera shots, original 19 takes,
  16 timing tracks, 3 unresolved recordings staged offscreen and flagged.
  Scratch original score/wind/birds/footsteps/shard cues, not final music.
- Renderer revision e3cb4348e93116c5cf56c3c9c9fa8b6a3cd2e8da,
  endpoint cfog2x4xsd0adz, RTX PRO 6000 Blackwell OPTIX, 1080p24, 48 samples.
  No duplicated/interpolated frames. All range/clip checksums in job manifest.
- Earlier 6-second GPU gait diagnostic already complete and decoded:
  data/V024/WonderlyTales_V024_GPU_6s.mp4, full result ops/v024-gpu-gait-result.json.

## Hungarian audio / FEATURE_V002
- 132 original recordings retained and hash/format checked. 20 flagged takes
  independently transcribed using no-prompt medium Whisper: 7 normalized
  matches, 13 differences. No auditory/phonetic/acting approval claimed.
- Listening comparison reel 79.167 s: local data/V024/audio-review/
  WonderlyTales_20_hang_ellenorzes_V024.mp4; durable R2 audio/S1E1/review/V024/.
  `ops/independent-speech-review-v024.json` and reel manifest hold evidence.
- FEATURE_V002 unchanged: 40 units, 244 lines, 131 story recordings plus 113
  new lines; 132nd existing take is the separate end-card CTA. Voices intact.
- NEW complete editorial draft: 329 shot entries, 37 new unit-specific director
  notes plus 35 native opening shots/accepted intro reuse; blocking, camera,
  sound and prop continuity written. Source SHA
  72492a266fbcaea03c51e34a93a925f9153cedde42954fbe5b9739de74468693.
- `scripts/build-feature-storyboard-v024.py` writes storyboard_V024.json,
  timed_reading_V024.json and new_recording_manifest_V024.json in feature_V002.
  Offline HTML: data/V024/Csodakapu_FEATURE_V002_storyboard_V024.html.
  All 5 artifacts persisted under native/S1E1/V024/preproduction/; hashes in
  ops/feature-storyboard-v024-artifacts.json. Every line binds exactly once.
- Content-based EDITORIAL ESTIMATE: 2394.041 s (39:54), includes titles.
  This is not performed duration; actual_duration remains NULL. Target gap
  1205.959 s must be solved with real story development, not empty padding.
  Full performed animatic is not complete. New 113 TTS remains blocked until
  final script and actual timed reading. HTML can export real reading timings;
  pressing Next alone does not validate speech or acting.

## Remaining issues / guardrails
- Lili/Pötty/Bogyó knee peaks and visual naturalness; Morzsi 926 rest mouth
  folds; unmatched seams on Lili/Potty/Zizi/Bogyo; natural HU coarticulation,
  gaze, finger articulation and physical interactions need further native QA.
- No reference-film-quality claim: reference video could not be retrieved.
- No full 60-minute production run. Existing Supabase queue, 300-scene SQL
  task test, V016 accepted intro and original infrastructure remain unchanged.
  The 300-scene test is not proof of 300 real GPU renders.
- Budget day 2026-10-11 Asia/Saigon: $35.50 reserved, daily ceiling unchanged
  $200: $8 authoring, $2.50 gait, $22.50 nine opening ranges, $2.50 assembly
  (reservation 416e3140-cb2b-4f17-a02e-c4bb8effca83). Not verified vendor bills.
- RunPod runtime APIs work. Management endpoint returned 403; no bypass or
  worker scaling changes made. Provider-owned TTS key unavailable here;
  no new voices generated and no hidden/server credential extraction.
- Pure animation tests: 26 PASS; Python compile and storyboard JS syntax PASS.
- Git push via local CLI cannot authenticate; GitHub connector tree/commit/ref
  with expected-head lease works, then fetch and verify local tree equality.

Authoring extension reservation: 350b756f-300b-4e1b-b805-d2252f07f2e9 ($2).
