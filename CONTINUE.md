# WonderlyTales — TITOKVÁROS active continuation

## New user-authorized direction, 2026-10-11 Asia/Saigon

The active series is now **WonderlyTales: Titokváros**. This supersedes the
old Csodakapu repair direction and the AI comparison/purchase-hold next steps.
No full feature production until the new actual 45–60 second quality scene
is visually and audibly reviewed. No Disney characters, city or plot copied.

- Same repository; starting main `620bfc903b308092d8a6ec46cc495ea83e61a0df`.
- Csodakapu marked ARCHIVED in Supabase. All old files, models, voices and
  videos retained in place. Its historical handoff is
  `production/archive/CONTINUE_before_TITOKVAROS_20261011.md`.
- New series ID `a2746bb2-96da-50d2-a433-c0a61207b2da`; same Studio project.
  Eight new characters, eight districts, six 3600-second-target episodes
  seeded and read-back counted. These are plans, not completed movies.
- Canonical creative bible: `production/titokvaros/bible/series.json`.
  48-second, 7-shot, 3-character demo contract: `episodes/TV_S1E1/demo.json`.
- Three visual leads: Mira the otter, Brúnó the badger, Kipp the fruit bat.
  Original concept art persisted in project R2 with readback SHA;
  `ops/titokvaros-artifacts.json`. Concept art is NOT a rendered scene.
- Native new build: Blender 4.5.3 LTS, bundled Rigify, independent new code
  `production/titokvaros/animation/build_native.py`. No archived mesh/rig
  imported. Model/rig candidate is still under development and NOT approved.
- New Studio `/titokvaros` page and authenticated fixed-artifact route.
  Three new HU voice audition prompts and permanent per-operation claims.
  Provider secret remains server-side. New voice design/selection not yet
  live tested. Saved provider result precedes DB update; DB failure recovery
  reuses the same voice rather than creating another.
- Supabase ACTIVE_HEALTHY. Scheduler heartbeat live, zero remote jobs.
  Native RunPod cfog2x4xsd0adz authenticated health now responds 200: one
  idle healthy worker, zero queued/in-progress jobs, 36 completed jobs.
  R2 read and new concept write/readback verified. Vercel production READY.
  Studio browser session is signed in. Do not assume earlier 403 remains.
- Budget snapshot: $52 reserved / $200 daily ceiling (2026-10-11). No new
  GPU or TTS submission at this checkpoint. Reservation is not invoiced spend.
- Seven voice recovery/auth/claim/budget tests and TS typecheck pass.
- Artifacts go to `native/S1E1/TITOKVAROS/V001/` (new nested namespace inside
  the legacy worker's allowed project prefix; NOT old Csodakapu assets).
- No new license/subscription purchased. Rigify is bundled. Do not extract
  hidden production secrets; use existing authenticated Studio actions.
- Historical rejections concerning Library originals and TECH_AB audio
  exports remain separate. Do not retry those old payloads.

## Current work
Finish and inspect the new native asset proof; do not call a procedural
model movie-quality just because its bones or render succeeded. Continue
the full S1E1 screenplay and reusable animation/scene compiler, then produce
and inspect real moving-image evidence. Preserve all new checkpoints on Git
and R2. User does not authorize fake durations or relabeled old clips.
