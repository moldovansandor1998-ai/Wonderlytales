# TITOKVÁROS — independent series, native 3D

User-authorized creative reset, 2026-10-11 Asia/Saigon. Existing Wonderlytales repository and infrastructure. No Csodakapu assets are inputs to this series.

`bible/series.json` is the canonical creative contract. Names/designs are original proposals, not a legal clearance certificate. Existing Disney characters, city layouts and scenes are excluded. The concept board is visual development only; it is not proof of a rendered film.

Namespace: `production/titokvaros/`, shot IDs `TV_S1E1_*`, library assets `TV_CHAR_*`, `TV_ENV_*`. R2 authoring namespace: `native/S1E1/TITOKVAROS/` to remain compatible with the existing native worker's project prefix; the nested namespace isolates the new series. This compatibility prefix does not make these Csodakapu episode assets.

Stages are separate: DESIGN → MODEL_REVIEW → RIG_REVIEW → PERFORMANCE_REVIEW → LIGHTING_REVIEW → SOUND_REVIEW → FINAL_REVIEW. A rendered file is never automatically production-approved. Feature generation remains held until an actual 45–60s clip passes a visual and auditory review. Runtime targets are editorial intentions, never measured movie durations.

Blender 4.5.3 LTS, bundled Rigify. No paid add-on purchased. Rigify is used for editable body IK/FK; original species-specific ears/tails/wing controls and facial shapes are distinct from the archived V024/V025 system. Assets contain local materials, no external Python required to evaluate poses in the render worker. Blender's trusted rig UI is optional for authoring, never enabled on the GPU worker.

The existing Supabase scheduler, RunPod endpoint, R2 bucket and Vercel project are retained. Dispatch goes through the existing bounded native contract and budget. `SUBMISSION_UNCERTAIN` never means safe to resubmit. Credentials never enter Git, assets, or user documents. Daily ceiling $200, new paid subscriptions/licenses require approval.

## Archive

Csodakapu files remain in their original paths to preserve references and hashes. Its database series status becomes ARCHIVED. Nothing is deleted, moved, overwritten or reused as a Titokváros character. The historical CONTINUE.md is retained separately when the new handoff is written.

## Implemented development pipeline (not film approval)

- `animation/build_native.py`: new original procedural diagnostic meshes and
  bundled Rigify skeletons. These meshes are **blocking assets**, not approved
  feature-film hero models. No old Csodakapu rig is imported or repaired.
- `animation/motion_library.py`: distance-based foot planting, independent
  species timing, IK/FK control poses, blink/gaze and expression gestures.
- `animation/assemble_demo.py`: seven cameras, 1152 authored frames, three rigs,
  six articulated background animals, elevated tram, cargo trolley, hand IK,
  and a conduit-light cue. Camera tracking and arm poles received corrections.
- `animation/audit_motion.py`: evaluated world-space foot and wrist checks.
  A passing number does not approve visual deformation or finger contact.
- `animation/compose_audio.py`: original procedural score/foley/ambience stems.
  It reports zero dialogue when no real recorded dialogue exists.
- `pipeline.py`: 1–500-shot validation, bounded frame chunks, durable SQLite
  state, immutable content identities, no automatic uncertain resubmission,
  local revision invalidation, and preservation of superseded records.
- Studio native rendering: only immutable allowlisted diagnostic jobs can be
  submitted. Source SHA, an atomic cost reservation, permanent R2 claim,
  durable RunPod job id, exact frame validation and downloaded clip SHA are
  checked. This does not start a 60-minute film.

## Explicit quality hold

The procedural hero meshes do not match the concept art. The face topology,
shoulder/arm deformation, bat wing membranes/fingers, full physical acting,
close-up cloth/fur and facial performance require substantial new modeling
and animation authoring. Render success, Rigify generation, planted-foot
measurements or a longer timeline cannot remove that hold.

The original three Hungarian voice designs produced nine auditions. The
existing ElevenLabs account has 10/10 custom voice slots occupied. Saving a
new voice received HTTP 400. No old voice was deleted and no subscription
upgrade was made. The original auditions are preserved in R2. New casting
and actual timestamped dialogue remain pending; do not claim audio is done.

2026-10-11 checkpoint: all eight real timestamped HU lines now exist under
`dialogue/` in R2. Licensed temporary work-track casting uses Sarah/Brian/Will;
none is an archived character voice. New original casting remains pending.
The actual 48-second mix includes dialogue and three original synthesized stems.
The initial 4-second Full HD video was inspected and did not pass the artistic
bar. The complete development cut tests sound, editing and native continuity;
it is not the approved professional demo. See QUALITY_REVIEW_V001.md.
