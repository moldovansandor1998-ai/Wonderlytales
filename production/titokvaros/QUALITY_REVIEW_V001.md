# Titokváros — first native motion review

Decision: **DEVELOPMENT ONLY; NOT APPROVED FOR FEATURE PRODUCTION.**

Reviewed evidence: actual RunPod-rendered `TV_GAIT_V001`, 96 different native
frames, 1920×1080, 24 fps, exactly 4.000 seconds. Downloaded clip SHA-256
`2a8168b71eb3fd7f5fb8cd29ea16c9d650ac5ff0ec48eb65f2d3ad16a3417659`.
All 96 decoded frames were visually inspected in ordered frame sheets.
No real-time full audiovisual watch is claimed: this diagnostic has no audio.

The three new animals move through a consistent 3D set; the camera, legs,
arms, gaze, background residents and tram are authored animation. This is
not a still-image slideshow, an old clip or an AI-generated video. Actual
render time was 257.22 GPU seconds; total provider execution 276.187 seconds.

## What works technically

- Generated Rigify skeletons and native keyframes survive source packing and
  remote rendering with scripts disabled.
- Correct frame count, resolution, playback rate, decode and downloaded hash.
- Evaluated planted-foot displacement below 0.32 mm/frame on the tested range.
- Background characters and moving camera remain consistent between frames.
- No duplicated frames are used to extend duration.

## Why it fails the requested artistic bar

- Hero silhouettes/faces and costumes do not yet match the original concepts.
  The current rounded procedural forms still read as simple blocking models.
- Arm/shoulder skinning and bat membrane/finger topology require fundamental
  asset work. Wrist target accuracy is not proof of believable finger contact.
- The gait lacks weight shifts, rich species-specific body mechanics and
  overlapping secondary motion expected from feature animation.
- Eyes and mouth controls exist, but performance is not yet film acting.
- The city set is coherent but too repetitive and sparse for the target.
- This four-second diagnostic cannot prove dialogue, emotional editing,
  full-scene continuity, an action event or sound quality.

## Corrections made from evidence

Connected edit-bone endpoints were previously transformed repeatedly, causing
bad proportions. The builder now snapshots the rest skeleton before remapping.
Data-API object binding previously read stale world matrices, moving some
meshes to the origin; binding now preserves the authored local basis. Separate
capsule limbs were replaced with continuous subdivided skins. A later camera
shot lost the actors: the corrected camera follows the same actual root path.
Arm pole targets and dual-quaternion deformation were added for the contact
pose; visual shoulder deformation is still not accepted.

A smaller-head modeling experiment was rejected visually and did not replace
the canonical source. Avoid repeatedly rendering these same weak models as
if sample count or duration could produce feature-film quality.

The next 48-second development cut must keep `production_approved=false`.
Its purpose is to test actual Hungarian timing, scene editing and the complete
native production path. It must not be labelled the finished professional demo.
