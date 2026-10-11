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

## Full-scene integration review, in progress

The first 12-second chunk of V003 completed: 288 Full HD frames, real packed
Hungarian audio, clip SHA
`73d3eb4e339943e40a7a86e22a82382f8a8783fefddb2130f0802bd7bbe67665`.
The actual video was decoded into a 24-image ordered sheet (2 fps). It shows
continuous locomotion and a cut to dialogue, but it also exposes a performance
bug: the head controller's local Z axis was used as if it were world yaw.
Rigify's upright head bone has a different local basis. The assembler now
converts the intended world rotation into the rest-bone basis. This correction
belongs to a separate V004 source candidate; the current V003 integration movie
must not be represented as containing it. Do not rerender the full film to
hide the remaining blocking-model problems.

The first continuous-garment remesh introduced shoulder crumpling and was
rejected. A second experiment explicitly includes scapular bones and blends
four influences; it requires visual evaluation before any promotion.

The 48-second real sound mix measures -17.79 LUFS integrated and -2.94 dBTP
true peak with ffmpeg loudnorm. This is a technical measurement only, not
approval of voice acting, Hungarian pronunciation or the listening experience.
The first screenplay contains about 1600 dialogue words under the mechanical
uppercase-speaker count. It is a complete story draft, but not an established
40–60-minute shooting script. A timed read and substantial dramaturgical work
remain necessary; never fill the runtime with loops or artificially slow speech.

V004 head correction was rendered at dialogue/contact frames 245 and 711:
head turn direction is now readable, with eased transitions rather than abrupt
angle switches. Source SHA
`d9dbdb566f3b09680dc64a6d41f10293f5c851a5f038a053dc21a6026d034eda`.
This source is preserved in R2, but has no full paid render and no approval.
Both shoulder-union studies were rejected after real 3D frame inspection;
the second still has visible tearing/crumpling. Their sources and review images
are preserved in `TV_MODELING_STUDIES_V001.zip`. A proper shoulder topology and
explicit deformation authoring are required; do not keep promoting remesh output.
A new three-view concept sheet for Mira/Brúnó/Kipp is a sculpting reference, not
proof of native model quality and not an exact engineering orthographic drawing.


Actual PART2 review: 24 sampled video frames plus all 24 consecutive frames at
run onset were inspected. The moving trolley visibly intersects Bruno. This
is a blocking animation failure, not noise or low sampling. V005 changes the
trajectory so the heroes chase a cart ahead of them. Native evaluated geometry
checks on 241 frames changed from 82 torso-box intersections (V003) to zero
(V005). A separate 2-second native diagnostic is planned; V003 stays rejected.
