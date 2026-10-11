# WonderlyTales — TITOKVÁROS active continuation

## User direction, 2026-10-11

Continue the same repository/infrastructure, preserve all Csodakapu assets,
but build an original anthropomorphic-animal series. No Disney copying.
Quality is demonstrated by real video; target 45–60 seconds before full films.
Do not call procedural models film-quality. $200/day maximum, not a spending
target. New paid subscriptions/licenses require user approval.

## Durable work completed

- Csodakapu series marked ARCHIVED in Supabase; NO old source/model/audio/video
  deleted. Historical handoff preserved at
  `production/archive/CONTINUE_before_TITOKVAROS_20261011.md`.
- New Titokváros series `a2746bb2-96da-50d2-a433-c0a61207b2da`, existing project
  `a2b6d64a-08a0-474f-b7c0-fa71121b00ab`. 8 new characters, 8 districts and six
  planned 3600-second episodes seeded/read-back verified. Plans are not films.
- Original bible `production/titokvaros/bible/series.json`, all eight characters'
  visual concept sheets, 6-film arc, full first screenplay draft in Hungarian:
  `episodes/TV_S1E1/Titokvaros_S1E1_forgatokonyv_V001.txt` (38 scenes, ~6411
  words). Actual 40–60-minute duration is NOT yet proven by a timed reading.
- New authenticated live Studio page `https://wonderlytales.vercel.app/titokvaros`.
  Same GitHub repository. Significant checkpoints pushed to main; latest at
  this checkpoint `9772a8de5d25090815f70ba9cdcdda92979194e1`.
- R2 content-addressed readback records: `ops/titokvaros-artifacts.json`.
  Native namespace `native/S1E1/TITOKVAROS/V001/` fits the existing worker's
  allowlist; it does not reuse old Csodakapu assets.
- Persisted new original 35 MB Blender master, model proof, 97 MB animated
  source, asset/contact audits, screenplay and both concept sheets.
- Blender 4.5.3 LTS + bundled Rigify, independent new builder, three animal rigs,
  IK/FK, fingers, ears/eyes, mouth shapes, gaze/blinks. No old V024/V025 repair.
  Fixed connected-endpoint remapping and stale object-world-matrix binding.
  Connected limb meshes replace separate capsule joints.
- New 1152-frame / 24-fps / 7-camera authored blocking timeline, three leads,
  six articulated background animals, tram, cargo trolley, hand IK and light cue.
  Camera tracking correction and arm pole/DQ experiment in assembler.
- Evaluated first-5-second foot planting: maximum frame displacement below
  0.32 mm; wrist target error below 0.003 mm. These metrics do NOT approve
  anatomy, fingers, cloth, acting or visual quality.
- `pipeline.py`: resumable 1–500-shot ledger; 500-shot restart/local-invalidation
  tests pass. Unknown submission never repeats automatically.
- 12 TS auth/claim/budget/source/recovery tests pass; typecheck passes. Recent
  Vercel production builds READY. Existing unrelated Edge-runtime warning remains.

## Infrastructure and cost state

- Supabase `vruxiyvlynbivzjuijed` healthy, R2 read/write/hash verified, Vercel
  production healthy. RunPod native endpoint `cfog2x4xsd0adz` authenticated
  health is 200, Blackwell worker accessible. Added the previously missing
  plain production env `NATIVE_RUNPOD_ENDPOINT_ID`; left global old worker
  config unchanged. Same existing native renderer revision
  `e3cb4348e93116c5cf56c3c9c9fa8b6a3cd2e8da`.
- Baseline daily reservation was $52. Three voice-design requests reserved $3.
  The single 96-frame native diagnostic reserved $2.50. Reservations are not
  invoices. Every new paid operation must pass the atomic budget RPC first.
- New native render control uses permanent R2 claim + saved RunPod job id,
  immutable source SHA, exact frame/fps/dimension verification and clip hash.
- Current diagnostic `TV_GAIT_V001`, frames 1–96, 1920x1080, 48 samples:
  RunPod id `8834e8d0-60f9-4a77-b36e-049ba61b12bc-u1`.
  Source SHA `6a359a8282160407572fe47a4f14a38d804cff3bddd3c152a68b9987cff1814e`.
  Poll the existing job; DO NOT submit a duplicate. R2 state
  `native/S1E1/TITOKVAROS/V001/jobs/TV_GAIT_V001.json`.

## Audio: real result and concrete limitation

Three new original HU voice designs produced 9 actual audition MP3s in R2.
The ElevenLabs account has 10/10 custom voice slots occupied. Creating Mira's
persistent custom voice returned HTTP 400. No old voice was deleted and no
new subscription was bought. The original auditions stay preserved.
A read-only reconciliation confirmed no new custom voice was created.

A temporary casting action was added for three **premade licensed voices not
used by any archived character**, with repeated DB exclusion checks:
Mira=Sarah, Brúnó=Brian, Kipp=Will. This is explicitly TEMPORARY_WORK_TRACK,
not final original casting. It does not create provider voices or buy a plan.
Temporary casting WAS invoked and all eight real HU lines were recorded. UI supports bounded
HU `eleven_v3` with-timestamps line recordings, with per-line claims and
$0.25 reservation. Provider key remains server-side, never extract/export it.
Original procedural music/foley/city stems and actual 8-line HU mix generated.
Mira L06 moved to 29.1 seconds to remove overlap with Kipp. Listening approval
is pending. V003 packs all 11 sound strips and real viseme timing; source SHA
`10b4c5728d0c00079f2944bf35955f2c288e5e8cafb3fbe6ec579076a0367556`.

## Quality hold and immediate next steps

**NO approved 45–60 second demonstration exists yet.** The current master
models are clearly below the concept art and feature-film goal. Facial topology,
animal silhouette/wardrobe, wing membranes/fingers, arm deformation, organic
acting and audio need substantial authoring. Do not make 60 minutes of these
blocking assets and do not substitute AI stills/video for native animation.

1. DONE: 4-second native gait video completed, downloaded and all 96 decoded
   frames inspected. Full HD/24fps/4.0sec; technical success but art-quality fail.
   See `production/titokvaros/QUALITY_REVIEW_V001.md`.
2. DONE: all 8 real lines downloaded with hash and duration verification.
   Keep original casting pending; do not delete voices.
3. Use the corrected camera/hand assembler, actual lip timings and sound stems
   to build the next immutable source version. Never overwrite R2 V001 sources.
4. The 48-second **development scene** must remain unapproved if quality is
   inadequate. Do not equate a 1152-frame timeline with a completed video.
5. Continue targeted model/animation improvements based on actual footage,
   preserve evidence and refresh this file before handing off.

Local current repo `/workspace/scratch/ff478e8da6f9/Wonderlytales`.
Blender `/workspace/scratch/ff478e8da6f9/tools/blender-4.5.3-linux-x64/blender`.
Working master `data/titokvaros/candidate_004/TV_MASTER_V001.blend`.
Corrected camera/arm source `data/titokvaros/animation_003/TV_ANIMATED_V001.blend`.
Small-head candidate_005 was visually rejected; it must not replace the master.
Secrets are outside the repo in protected scratch, not in Git. Reacquire via
allowed configured connections if scratch is lost. Existing Studio signed-in
browser session can invoke the proper authenticated operations.

Historical rejections for Library old Lili.blend / TECH_AB payloads remain
separate: do not retry those old exports. All current assets are new Titokváros.

## Active V003 review checkpoint

V003 is a 48-second DEVELOPMENT render only, never approved. Four bounded
288-frame jobs are defined in render-manifest.json. Their per-job source SHA
is distinct from old gait V001. Submit once through authenticated Studio only
after source readback; poll saved ids. Each reserves $2.50 against daily cap.
Camera tracking, gaze, brake lever, arm poles, real Hungarian audio/visemes
and light cues have changed. Do not overwrite immutable V001 artifacts.

V002 revealed a cropped emotional dialogue camera; V003 widens shot 5 before
paid rendering. V002 remains preserved, not overwritten.

## Separate reusable libraries now persisted

Nine compressed native .blend libraries (3 characters, quay, lighting, trolley,
tram, 7 cameras, 6 background residents), all independently reloaded and checked.
Three additional motion libraries contain six real walk/run Actions. Manifests:
`published-libraries.json`, `published-motion.json`; R2 hashes in ops registry.
12 asset records, 3 character versions, 6 animation records and one location
version registered idempotently in Supabase, all DEVELOPMENT_UNAPPROVED.
`assemble_demo.py --libraries <dir>` rebuilds the voiced scene from these files;
actual frame 171 was rendered and visually compared to the monolithic source.
500-shot ledger supports per-shot source hashes; changing one leaves 499 intact.
No existing archive asset was modified or deleted.

Active GPU jobs (do not re-submit):
- PART1: 86ee479e-6408-402f-b8e8-9d2c124e7daa-u1
- PART2: 9c1565a5-ab19-4332-be37-5a62c2903baa-u1
- PART3: 01ae7c72-3109-4273-8501-56d9a7df3b64-u1
- PART4: 89430fee-2775-4213-a61a-4efa9742d9b6-u2
All `TV_DEMO_V003_PARTn`. Same existing endpoint, no scaling changes.
Read-only `scripts/titokvaros-render-status.py --config <protected-config>
--download` verifies/downloads completed clips and counts durable frame checkpoints.
Current daily reservation readback: $69.50 on budget day 2026-10-11, not invoices.
Full 48-second rendered movie remains pending until all four verified clips exist.

## Actual V003 review findings

PART1 finished (288 frames/12 seconds/audio), SHA recorded in QUALITY_REVIEW.
Subsequent parts still pending at this checkpoint. Source inspection against
actual video exposed incorrect head yaw-axis handling; fixed in assembler's
V004 candidate with rest-basis conversion. The immutable V003 render remains
an integration work copy, not an approved performance. V004 is not in the GPU
queue. First fused-shoulder mesh failed review; second candidate is unapproved.
First screenplay is about 1600 dialogue words, so do NOT imply that 40–60 minutes
has been written/timed/proven. Full story arc exists; feature length is pending.
Archived historical film runs are tagged and the Studio server blocks RESUME;
PAUSE and all old media/history stay available. Three archive regression tests pass.

V004 candidate persisted with readback SHA
`d9dbdb566f3b09680dc64a6d41f10293f5c851a5f038a053dc21a6026d034eda`.
It corrects head rotation basis and eases the conversational turns. Two actual
rendered frames were inspected, but this is not a full revised video. Keep V003
source attached to the current V003 movie; do not mislabel source/film versions.
Both shoulder-union candidates were rejected; preserve the canonical master.
Rejected studies zip and new three-view concept sheet persisted in R2; hashes
are in ops/titokvaros-artifacts.json. Next modeling work needs authored shoulder
edge flow, not another blind remesh or additional render samples.

## V003 collision finding and V005 correction

Actual PART2 video revealed the trolley passing through Bruno's torso. A native
Blender audit of 241 chase frames found 82 crate/torso AABB intersections in V003.
The V005 source moves the cart ahead in a separate lane, eases its trajectory,
rolls the wheels, and computes grip targets from the moving cart. The same
241-frame audit reports zero torso intersections. This is NOT a full collision
or acting approval; fingers, wings and feet still need review.
V005 source SHA `b866b7d3464082ecdcedc1005cf67c1ea75c4909b59b3f21b1bdd8e18a374155`.
A distinct `TV_CONTACT_V005_2S` diagnostic, frames 489–536, is defined for a
short actual-video verification. It is not part of the 48-second V003 assembly.
Do not rerender the entire weak-model movie merely to claim quality improvement.
