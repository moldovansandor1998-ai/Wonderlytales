# WonderlyTales: Titokváros — authoritative continuation

Updated 2026-10-11. Continue this existing repository and infrastructure.
Csodakapu is archived, not deleted. All new characters/world assets are original
Titokváros work. No Disney asset, character, city or scene is imported.

## Current result and hard quality hold

**No professionally approved 45–60-second demo exists yet.** Native animation
and Hungarian audio work, but the procedural hero models, shoulder deformation,
bat wings/fingers, physical acting and facial performance fail the requested
feature-film bar. Do not launch 40–60 minutes of these assets. Do not turn a
successful render or concept illustration into a quality claim.

The full V003 48.000-second movie is COMPLETE: 1152 frames, 1920×1080, 24fps,
stereo 48kHz AAC, full decode/frame verification passed. The separate corrected
2.000-second V006 video is also COMPLETE. Neither is quality-approved.
Final movie `TV_motion_review_V001.mp4`, SHA
`15635367e37cde98948c700217b66c2083f682d2b11ba6e9ef6bfad2a8692efe`.
Final audit: `ops/titokvaros-final-media-audit.json`.
Read `ops/titokvaros-render-results.json` and reconcile the saved provider IDs
before acting; the on-disk results file can lag the remote jobs.

## Completed jobs — never submit duplicates

| Job | RunPod provider ID | Source |
| --- | --- | --- |
| TV_DEMO_V003_PART1 | 86ee479e-6408-402f-b8e8-9d2c124e7daa-u1 | V003, frames 1–288 |
| TV_DEMO_V003_PART2 | 9c1565a5-ab19-4332-be37-5a62c2903baa-u1 | V003, frames 289–576 |
| TV_DEMO_V003_PART3 | 01ae7c72-3109-4273-8501-56d9a7df3b64-u1 | V003, frames 577–864 |
| TV_DEMO_V003_PART4 | 89430fee-2775-4213-a61a-4efa9742d9b6-u2 | V003, frames 865–1152 |
| TV_CONTACT_V006_2S | 8fd969a2-96c3-4512-bcf2-7d9a9a03d4a7-u2 | V006, frames 565–612 |

Earlier `TV_GAIT_V001` is COMPLETED: 96 frames/4.000s/1080p/24fps, SHA
`2a8168b71eb3fd7f5fb8cd29ea16c9d650ac5ff0ec48eb65f2d3ad16a3417659`.
All 96 decoded frames were inspected; quality failed. V005 was never submitted.

The complete V003 cut must contain only its four contiguous verified parts.
Do not splice V006 into it or claim V003 contains the later corrections.
`python3 scripts/titokvaros-render-status.py --config /protected/runtime.json
--download --diagnostics` polls existing jobs, verifies metadata/hashes and
retrieves clips. It never submits paid work. The Studio's authenticated refresh
buttons reconcile the durable UI job states separately.

## Source versions and evidence

R2 namespace: `native/S1E1/TITOKVAROS/V001/` (existing worker-compatible prefix,
not the old series). Exact keys, sizes and readback SHA records are in
`ops/titokvaros-artifacts.json`. Never overwrite immutable source versions.

- V003 `TV_ANIMATED_V003.blend` SHA
  `10b4c5728d0c00079f2944bf35955f2c288e5e8cafb3fbe6ec579076a0367556`:
  packed actual HU audio, seven cameras, 1152 authored native frames. This is
  the source of the full integration work copy, with known defects.
- V004 corrects the head controller's local/world rotation basis and eases
  conversation turns. Actual stills 245/711 reviewed, no full rerender.
- V005 SHA `b866b7d3464082ecdcedc1005cf67c1ea75c4909b59b3f21b1bdd8e18a374155`:
  corrected trolley lane/trajectory, wheel rotation and moving grip targets.
  The same 241-frame native torso-AABB audit reports 82 intersections in V003,
  zero in V005. This does not approve hands, wings, feet or physical forces.
- V006 SHA `87d4cb87481052d73761d30f9416264e44532cc29597c3214ae04c5431f60389`:
  keeps V005, moves chase camera inside the lamp-post line. Actual local
  frames 577/589 no longer have the pole obscuring the grip. All 48 frames of
  the actual short test were inspected: obstruction/torso crossing improved in
  that interval, but weight, shoulder and finger contact still fail. Clip SHA
  `bc491cdfb7beb6fca77d75700409eb626f37754da16d06b0d5490872cc4bba89`.
- Small-head candidate and both remeshed-shoulder candidates were REJECTED.
  Preserve the canonical master. The rejected native modeling studies are in
  `TV_MODELING_STUDIES_V001.zip`; do not promote another blind remesh.

Full evidence and limits: `production/titokvaros/QUALITY_REVIEW_V001.md`.
The actual first three clips show the head-axis bug, trolley/torso penetration,
foreground occlusion, stiff acting and poor grip/wing anatomy. Later source
corrections do not remove the full-model quality hold. Story directions such
as map handling and gap crossing are not all implemented performances.

## Creative work

- `production/titokvaros/bible/series.json`: eight new animals (Mira, Brúnó,
  Kipp, Néra, Dorka, Áron, Tilda, Oszkár), species/age/look/costume/HU voice
  direction/movement/strengths/weaknesses/motives/arcs/relationships.
- Révszirt: eight original districts in a river-estuary terrace city. Six
  season stories use the requested titles and an original floodgate/map mystery.
- Three original concept boards cover all eight heroes and a three-view
  sculpting reference for the first three. They are not native model proof.
- `episodes/TV_S1E1/Titokvaros_S1E1_forgatokonyv_V001.txt`: complete first STORY
  draft in Hungarian, 38 scenes/~6411 total words, camera/sound directions.
  Mechanical dialogue count ~1600 words. NOT a proven 40–60-minute shooting
  script. `script_scope_audit.json` explicitly says runtime is unverified.
  Next writing work needs a timed read and substantial scene/dramaturgy expansion,
  not padding with loops, slow speech or arbitrary duration labels.

## Actual native production foundation

Official Blender 4.5.3 LTS + bundled free Rigify. Three new editable animal
rigs/diagnostic meshes with body IK/FK, fingers, tails/ears/eyes, visemes, blinks
and gaze. No V024/V025 character was repaired or reused. First five seconds'
foot displacement <0.32mm/frame; that metric does not approve movement quality.

12 independent compressed .blend library files: three heroes, quay set, light
rig, trolley, tram, seven camera templates, six background residents and three
motion files containing six real walk/run Actions. Reload/hash/dependency
checks passed. Supabase holds 12 assets, three character versions, six motion
records and one location version, all DEVELOPMENT_UNAPPROVED.
`published-libraries.json` / `published-motion.json` are the manifests.

`assemble_demo.py --libraries <dir>` actually rebuilds from verified character,
environment and light collections; props/extras/cameras are authored by the
assembler. A comparison frame was rendered. `pipeline.py` is a tested resumable
1–500-shot ledger with local invalidation and preserved superseded records.
It is not a claim that 500 finished scenes exist.

## Audio and account limitation

Three original HU voice designs produced nine saved audition MP3s. ElevenLabs
custom voice capacity is 10/10; saving a new voice returned HTTP 400. No old
voice was deleted and no plan/license was bought. Original casting is pending.

The demo uses licensed temporary premade voices Sarah/Brian/Will, verified not
to be archived character voices. All eight real HU lines have provider character
timestamps and verified MP3s in R2. V003 packs all eight and three original
synthesized music/effects/ambience stems. These are work tracks, not final casting
or professional recorded Foley. L06 starts at 29.1s to avoid overlap.
Actual mix: 48.000s, stereo 48kHz, -17.79 LUFS, -2.94dBTP. Technical measurement
only; full listening/Hungarian pronunciation and acting approval remain pending.
Provider secrets stay server-side. Never extract the ElevenLabs key.

## Infrastructure, archive and cost

- Same GitHub: moldovansandor1998-ai/Wonderlytales, main. Use current Git head
  rather than a stale commit string. Production Studio: /titokvaros; original
  /production remains available with archive badges and the new series link.
- Supabase project `vruxiyvlynbivzjuijed`, existing project row
  `a2b6d64a-08a0-474f-b7c0-fa71121b00ab`, new series
  `a2746bb2-96da-50d2-a433-c0a61207b2da`.
- Csodakapu series and its three historical film runs are archive-tagged.
  Server/UI blocks RESUME, PAUSE still works. No old media/source/history removed.
  Historical handoff: `production/archive/CONTINUE_before_TITOKVAROS_20261011.md`.
- RunPod endpoint `cfog2x4xsd0adz`, immutable existing native renderer revision
  `e3cb4348e93116c5cf56c3c9c9fa8b6a3cd2e8da`. Source/frame/hash contracts preserved.
  No worker scaling change. Read-only GraphQL config was blocked by Cloudflare;
  do not probe alternate routes to bypass it. Native /run and /status work.
- Vercel existing project retained. Added plain `NATIVE_RUNPOD_ENDPOINT_ID` only;
  existing global/legacy renderer config unchanged. Recent builds READY.
- $200/day hard cap, not spending target. Last readback: $72.00 in reservations
  on budget_day 2026-10-11, including baseline $52. This is NOT invoiced spend.
  Every paid operation goes through authenticated atomic budget reservation,
  permanent R2 claim, durable provider id; ambiguous submits never auto-retry.
  New paid subscription/software/license needs user approval.
- Six native-render, seven voice-control and three archive regression tests
  passed; five pipeline tests passed; TypeScript typecheck passed.

## Recovery / next steps

1. The full 48-second V003 movie and 2-second V006 test are complete. Do not
   resubmit them. `ops/titokvaros-render-results.json` lists every completed
   provider ID, clip hash, execution duration and verified frame count.
2. Main movie, final audit and QC evidence ZIP are registered immutable R2
   artifacts. `TV_QC_EVIDENCE_V001.zip` preserves actual decoded frame sheets,
   full completed provider JSON results and collision/contact evidence. It
   supports recovery even after temporary provider status retention expires.
3. Visual review used actual footage: 2fps samples of all four chunks, all
   24 run-onset frames, 16 final movie boundary/cut frames, all 48 V006 frames.
   This is NOT a full real-time audiovisual watch. Full listening still pending.
4. The first final encode failed (1151 frames, shifted video start). Corrected
   decoded-frame timestamps `N/24` with passthrough passed at exactly 1152/48s.
   No frame duplication, interpolation or GPU rerender was used for this fix.
5. Continue with authored shoulder/wing/face topology, silhouette/costume
   matching and real acting/physical contact. Both blind remesh studies failed;
   more samples or a longer render will not solve these defects. Then validate
   a short revised action and emotional close-up before any full-film launch.
6. Expand and time the first STORY draft to a genuine 40–60-minute shooting
   script. Full listening and original voice casting remain pending; custom
   voice slots are full and no upgrade has been authorized.
7. Keep `production_approved=false` until actual visual AND sound quality pass.
   Push significant work and refresh this file. Prior Library export rejections
   concerned old Lili.blend / TECH_AB payloads; never retry those old exports.
   The two NEW Titokváros video deliverables were successfully saved in one
   official batch: Titokvaros_48s_munkakopia.mp4 and
   Titokvaros_2s_javitott_kontaktproba.mp4.

Local repo `/workspace/scratch/ff478e8da6f9/Wonderlytales`; official Blender
`/workspace/scratch/ff478e8da6f9/tools/blender-4.5.3-linux-x64/blender`.
External protected config `/workspace/scratch/ff478e8da6f9/private/runtime.json`.
If scratch is lost, reacquire credentials via allowed configured connections;
never commit them. `scripts/titokvaros-restore.py` verifies registered new assets
and refuses to overwrite different local files. Two restores were verified.
See production/titokvaros/README.md for exact rebuild/recovery commands.
