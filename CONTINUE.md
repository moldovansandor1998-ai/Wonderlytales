# WonderlyTales — continuation checkpoint

Last successful Git commit: `8e0ea3e5a5b359346530839d6a51f17d689622fd`.
The commit containing this document follows it (`git log -1`).
Do not rebuild infrastructure or modify V022/V023 originals. Daily ceiling $200.
User's earlier verified base: 4266970498f2f4c5dc423f1de1a27ef58dbbfbaf.

## V025 central native repair checkpoint (2026-10-10 21:52 UTC)
- Development continues. No V025 movie or professional-quality approval yet.
  Preserve the complete 132-second V024, both immutable source scenes and HU mix.
- Thirty pure timing/motion tests pass. New stop logic retains support footprints
  and finishes the last swing. Native rebakes have evaluated all 1392 / 1776
  frames with reachable, fixed foot targets. Full final-candidate QA is pending.
- Mark eye candidate E passed all 1392 native frames: both eyelid boundaries and
  the existing mouth have zero missing boundary edges; maximum gap <0.000001 m.
  R2 native/S1E1/V025/mark_seams_e/S1E1_SC001_V025.blend, SHA
  0ec3997387a1f1aa8223e8dbc93c57e9c6f579f89aca8f5ebdd8b92c3849f82a.
  Evidence: ops/v025-mark-eye-seams-candidate-e.json. This is not eye-shape approval.
- Lili fur is disconnected geometry. Rejected experiments: voxel skin (no closed
  aperture), rectangular skin (visible surface patch), early local skin (wrong
  unevaluated parent transform), un-oriented eyes (deep artificial sockets).
  Latest local candidate H uses recovered existing V024 triangle edges, exact
  fur clipping, continuous per-eye skin, cheek-derived eye depth/orientation,
  connected eyelids and native short fur. The face still needs close/side/motion
  review. Do not promote an earlier Lili prototype based on seam numbers alone.
- mouth_support.py connects Lili's existing 64-vertex oral boundary to a local
  under-fur skin with identical boundary weights and shape deltas. Existing HU
  visemes, jaw, oral interior, original character geometry are retained.
- Grip A was REJECTED (wrong hand / 0.658 m handoff). B-D were also rejected.
  Grip E adds 10 left-hand digit bones to the existing mesh, skin landmarks,
  bounded 38.9 mm body reach with fixed foot controls, and rotational attachment.
  Evaluated grasp error 0.00025933 m; held rigid-transform error zero.
  Evidence: ops/v025-grip-candidate-e.json. Native source at sandbox
  /vercel/sandbox/v025/grip_e/S1E1_SC003_V025.blend, SHA
  94a74f11ed034c42ab7026299edc953b2a341ff32f712c92ce96a94a241ef05c.
  Finger articulation / surface collision / cloth appearance are NOT approved.
- Reusable finish_v025.py layers irregular fully sampled blinks, delayed partner
  responses, bounded gaze, 420 terrain-bound leaves, three soft lights and
  shallow camera arcs onto retained scenes. It rebakes held props after body
  changes. Original scene audio/visemes and shot endpoints remain unchanged.
- Final-candidate authoring is running in the existing sandbox:
  SC001: cmd_561f9fc940264e7ea0dac578ce55, log v025/candidate-sc001.log.
  SC003: cmd_24ae8d4c07fa49aa8830f1ffd692, log v025/candidate-sc003.log.
  Expected outputs /vercel/sandbox/v025/final_candidates/S1E1_SC00{1,3}_V025.blend.
  Do not assume completion: inspect exit codes and native reports.
- Next: independent all-frame audit_v025_native.py; diagnostic_cameras.py creates
  separate close/side sources (faces 1-192, grasp 505-648). Inspect proof frames,
  reserve budget before any GPU jobs, then render bounded review clips. A full
  new 132-second pass and further feature preparation remain behind quality QA.
- Budget verified 2026-10-11 Asia/Saigon: $39.50 reserved / $200 limit. No new paid
  resource, TTS or V025 GPU job has been submitted in this repair session.
  Existing sandbox sbx_hbrj4u6r1FOrgWWTiIRBSZUkGJFS expires ~22:25 UTC.
- Automatic approval review blocked exporting a recovered old Library Lili
  reference to R2. Do not retry or route that original elsewhere. Current
  candidates use only the existing V024 scene and its retained edges.
- Git-backed code and reports are saved; native source persistence must also be
  confirmed before stopping the authoring sandbox. Feature target remains
  >=40/default60 minutes, with no downstream production approval.

## Completed opening review (2026-10-10T20:37:33.786910+00:00)
- All NINE existing GPU clips decoded: 3168 native frames, 1080p24, 132 s.
- Full movie assembled by unchanged CPU native_assembly.py; original frozen
  Hungarian mix SHA c5ef49ad4a17959dc6c35d40a1c522d83fe13f112e667027d810bc73b00c9a4d.
  Complete output decoded and R2 readback checksum verified; local copy also
  downloaded, SHA checked and decoded. No duplicate GPU/assembly submissions.
- Movie key: renders/native/S1E1/assembled/d7e8b9523381b50e5a78dc7c6a30ca6ae90bab95f19ee0f744e5a7901a02bd75/master.mp4
  SHA a76eec569f2d81da981aac2db3ead7f7a4e30fe9dc7b195af705cd13cc95ade8
- Source of truth: ops/v024-opening-storage-review.json, separate from last
  observed provider statuses. ops/v024-opening-assembly.json now points to
  the verified result. Do not restart completed jobs or reassemble this movie.
- All three recovery entry points now use the same R2 conditional lease;
  the obsolete provider `submit` operation is rejected before credential use.
- Preview registry and /native-assets now include this complete review.
- This is an inspection movie, NOT final animation approval. Gaze/eye seams,
  rigid scarf attachment and finger articulation remain blocking issues.
  See ops/v024-opening-visual-review.json for frame/shot evidence. Candidate C
  is separate and unapproved; the frozen V024 movie does not contain it.
- Next native authoring work: true eye/skin boundary reconstruction and
  supported hand/scarf contact. Preserve all existing sources and voices;
  do not launch the feature or a new full GPU pass before candidate proof QA.

## Earlier recovery checkpoint (2026-10-10 20:15 UTC)
- Seven existing clips / 2472 native frames / 103 seconds decoded. Two clips
  remain; full 132-second movie is NOT complete yet. Do not resubmit jobs.
- Canonical storage-only watcher: cmd_875a2effd661475192bdb46793fd,
  PID 20508, /vercel/sandbox/project, --watch-seconds 6000, running after the
  previous observer exited. Log /vercel/sandbox/storage-review-leased.log.
  New R2 lease prevents duplicate recovery/assembly; five fault tests pass.
  Reuse S3_* env and PYTHONPATH=/vercel/sandbox/python-deps. Entry points
  scripts/resume-opening-from-storage.py and scripts/watch-opening-review.py
  both use storage only. Already verified full movies are reused after restart.
  Latest artifact checkpoint: ops/v024-opening-storage-review.json / R2
  native/S1E1/V024/checkpoints/opening_storage_review_cloud.json.
- Earlier provider-API watcher was stopped at 20:06 UTC. No new GPU jobs,
  assembly provider requests, TTS, or worker scale changes were submitted.
- Same authoring sandbox extended until approximately 22:25 UTC. Budget
  reservations 7e80035d-b20d-4ca9-b85d-b4b23c2c3789 and
  c8dffde9-b9e1-40bc-add2-2ae7e580cc88 ($2 each). Known daily reservations
  now $39.50, not vendor invoiced spend; ceiling remains $200 Asia/Saigon.
- Separate SC001 V025 eye candidate C saved with native proofs and report at
  native/S1E1/V025/gaze_candidate_c/. Blend SHA
  a8758b1537bb383c80bc7bc0350a4939d2c0d573262e1380a588a9e161373041.
  All 1392 frames measured: maximum head-relative eye angle reduced from
  53.60/57.98 to 19.63 degrees; maximum step from 53.60/57.98 to 8.10 degrees.
  Repaired collapsed custom-property ranges, bounded head-relative gaze,
  closed head-bound sclera, and conformed independent iris/pupil surfaces.
  Visual proofs 145/217/289: eye-socket and outer lid seams STILL VISIBLE.
  Candidate is NOT production approved and NOT promoted into frozen V024.
  Candidate B is superseded and not approved. Do not rerender the opening
  merely because the numeric eye-angle gate improved.
- Preview links added to the existing /native-assets page using the same
  authenticated download route. Typecheck and five download tests pass.
- Read-only eye boundary diagnostic saved in ops/v025-eye-boundary-diagnostic.json;
  temporary merge only, no character body mesh changed. Branching boundaries
  confirm that a simple radial stitch is unsafe.
- Next: wait for final two exact clips, assemble using unchanged native
  assembly with original HU mix, decode/readback, save review. Facial seam
  repair requires true boundary correspondence, not another overlay.

## Earlier running state (superseded by checkpoint above, 19:40 UTC)
- Existing NINE native GPU jobs cover SC001 58 s + SC003 74 s (3168 frames).
  First four SC001 clips fully decoded; 58-second scene mixed and saved.
  Do not resubmit existing jobs or rerender finished frames.
- RunPod runtime GET now fails with proxy tunnel 403. Do not reroute the
  blocked API through another machine. Independent R2 artifact reads work.
  Provider statuses in the original manifest are LAST OBSERVED, not live.
- Local Work execution environment became offline at ~19:32 UTC (registry
  environment_offline). Local watchers are NOT known to be running.
  Do not assume local uncommitted files survived; recover them if possible.
- Existing native Vercel sandbox remains available until ~20:25 UTC:
  sbx_hbrj4u6r1FOrgWWTiIRBSZUkGJFS. Official Blender 4.5.3 LTS.
  Same repository checkout restored at /vercel/sandbox/project.
  R2-only watcher cmd_6cffba85b3164f269409fa6b378c runs for 1800 seconds
  (~until 20:11 UTC). No RunPod API requests. Separate R2 checkpoint:
  native/S1E1/V024/checkpoints/opening_storage_review_cloud.json.
  At 19:45 UTC five clips / 1752 frames / 73 seconds fully decoded; next
  range has 155 persisted frame objects. Counts of PNG objects are not
  completion or decode approval. Resume script with S3_* env and PYTHONPATH
  /vercel/sandbox/review_deps, --watch-seconds 1800 after this watcher exits.
- Native all-six 20-second motion diagnostic completed: 480 frames, 768x432,
  CPU 4 samples, silent. R2 native/S1E1/V024/cast_preview/
  WonderlyTales_V024_all6_motion_20s.mp4 SHA
  8abf78d258d56036a73820a695eab3c24bf2819d5cc5aef154608821eb18b939.
  Twelve neutral/expression face PNGs and full 480-frame topology QA saved
  and read back with matching SHA256. See ops/v024-native-final-artifacts.json.
- First complete GPU scene: renders/native/S1E1/review/V024/SC001_58s.mp4,
  1392 frames, 1080p24, original Hungarian mix, fully decoded. SHA
  6e1ecd21fe2476a6be3c9181d2e69a52e8997dd8d34c19a8ade6b1435ad81956.
  The 132-second connected movie is NOT yet complete.
- Full original-HU mix remains saved at
  audio/S1E1/review/V024/WonderlyTales_V024_opening_132s.wav,
  SHA c5ef49ad4a17959dc6c35d40a1c522d83fe13f112e667027d810bc73b00c9a4d.
  Assembly reservation exists, but no remote assembly job was submitted.
- Next: resume independent R2 artifact verification, assemble only after all
  nine exact ranges are decoded, using unchanged worker/native_assembly.py.
  Keep artifact completion separate from unknown live provider status.

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
- RunPod runtime and management API access are now blocked by 403; no bypass,
  resubmission or worker scaling changes made. Provider-owned TTS key unavailable here;
  no new voices generated and no hidden/server credential extraction.
- Pure animation tests: 26 PASS; Python compile and storyboard JS syntax PASS.
- Git push via local CLI cannot authenticate; GitHub connector tree/commit/ref
  with expected-head lease works, then fetch and verify local tree equality.

Authoring extension reservation: 350b756f-300b-4e1b-b805-d2252f07f2e9 ($2).

## Additional saved evidence and pending local recovery
- Stricter mouth QA verifies consecutive seam vertices are actual body edges.
  Morzsi's current aperture has 269 perimeter vertices but only 96 consecutive
  mesh edges; mouth landmark lies outside its perimeter (angular gap 3.1787).
  Radial repair candidate still had 22 folds versus 926 original, REJECTED.
  No candidate was saved/promoted. New early guard rejects invalid aperture.
  Restore original same-character face and recut correctly before retopology.
- Full offline timed storyboard/audio reader saved in R2 at
  native/S1E1/V024/preproduction/Csodakapu_idozitett_storyboard_V024.html,
  7,366,862 bytes, SHA
  e380d82df9d9c8fcccc9817643a692c1d10e51adf1c92f48404323dbd4f36bfa.
  329 boards, 131 embedded original recordings, 113 unrecorded reading cards.
  This is an editorial reading tool, not a completed performed 3D animatic.
- Recreated and tested pending app changes on the restored same-repo checkout:
  NativeRenderWorker reserves native_render, transmits/validates the renderer
  revision, and rejects a mismatched exact frame range even if length matches.
  Shot schema retains the immutable renderer revision.
  27 focused tests PASS; TypeScript typecheck PASS. No paid provider used in tests.
- Existing authenticated native download route now also admits the explicitly
  registered V024 review files and hashed assembled-film keys. Admin/studio
  authorization and private/no-store redirects remain enforced.
  New src/lib/native-review.ts provides exact artifact metadata.
- R2-only resume observer source saved in scripts/resume-opening-from-storage.py.
  Full validation uses unchanged worker/native_assembly.py. No new GPU work.
  Source manifest is read-only; artifact status never overwrites provider status.
- Morzsi frame-456 native face render visually inspected in browser: severe
  torn/spiked oral geometry confirmed. This source is NOT production approved.
