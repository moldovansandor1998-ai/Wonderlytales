# TITOKVÁROS — independent series, native 3D

User-authorized creative reset, 2026-10-11 UTC. Existing Wonderlytales repository and infrastructure. No Csodakapu assets are inputs to this series.

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
upgrade was made. The original auditions are preserved in R2. Final original casting remains pending; temporary recorded dialogue exists as described below.

2026-10-11 checkpoint: all eight real timestamped HU lines now exist under
`dialogue/` in R2. Licensed temporary work-track casting uses Sarah/Brian/Will;
none is an archived character voice. New original casting remains pending.
The actual 48-second mix includes dialogue and three original synthesized stems.
The initial 4-second Full HD video was inspected and did not pass the artistic
bar. The complete development cut tests sound, editing and native continuity;
it is not the approved professional demo. See QUALITY_REVIEW_V001.md.

## Published native libraries

`published-libraries.json` lists nine reload-verified `.blend` collections;
`published-motion.json` lists six native Action assets in three files. They are
registered in Supabase with explicit DEVELOPMENT_UNAPPROVED status. The Studio
exposes authenticated downloads for the individual assets. The assembler can
now use `--libraries <directory>` instead of a monolithic `--master` source.
Its actual rendered comparison frame matches the original composition.

`pipeline.py` accepts optional immutable `source_sha256` per shot, allowing a
single independently exported scene to change without invalidating 499 others.
The tested ledger does not claim the existence of 500 finished scenes.

`scripts/titokvaros-assemble-review.py` accepts only four completed, hash-verified
native chunks. It creates exactly 1152 frames with the real 48-second audio mix,
adds a visible development label and verifies full decode. It never pads time
with repeated frames or marks the result production-approved.

## Recovery and reproducible commands

Read the current root `CONTINUE.md` first. Install the repository dependencies
with `npm ci`; use official Blender 4.5.3 LTS with bundled Rigify. Configuration
is an external protected JSON file containing existing R2 connection settings
(and RUNPOD_API_KEY only for status reconciliation). Never put it inside Git.

Restore only needed new artifacts, verifying their registered hashes:

```sh
python3 scripts/titokvaros-restore.py --config /protected/runtime.json \
  --out data/titokvaros/restored TV_ANIMATED_V006.blend
```

For a source rebuild from the independently published libraries, restore the
nine collection files listed in `published-libraries.json` plus
`library_manifest.json` into one directory; restore actual dialogue with
`scripts/titokvaros-download-audio.py`. The three original WAV stems live beside
their registered sound mix. Do not generate voices again just because scratch
is empty. Existing permanent R2 claims and recordings are authoritative.

```sh
blender -b --python production/titokvaros/animation/assemble_demo.py -- \
  --libraries data/titokvaros/restored \
  --audio data/titokvaros/dialogue --stems data/titokvaros/audio_stems \
  --out data/titokvaros/rebuilt
python3 scripts/titokvaros-render-status.py --config /protected/runtime.json \
  --download --diagnostics
```

The assembler emits a NEW candidate, not an immutable released asset. A
rebuild may have a different file hash. Use a new version before publishing;
never replace the registered V003/V004/V005/V006 sources. Submit only through
the authenticated Studio after source readback and a successful budget claim.
The status command only polls existing provider ids; it never submits a job.
`TV_CONTACT_V006_2S` is a separate 565–612-frame correction test and must not be
inserted into the four-part V003 movie as if it shared the same source.

Run `python3 scripts/titokvaros-assemble-review.py` only when all four V003
chunks are locally downloaded and verified. The movie contains known rejected
modeling/performance defects. A complete output file is not a quality approval.
