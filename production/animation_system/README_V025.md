# V025 reusable repair candidates

V024 is immutable. These modules operate on copies of existing native Blender
scenes. No new character identities, Hungarian recordings or renderer deployment
are introduced. **The current candidates are not production approved.**

## Source-preserving pipeline

1. `repair_eye_seams.py` / `facial_seams.py` map an actual source cut perimeter
   to each eyelid, preserving boundary vertex weights and shape deltas.
   `seam_edges.py` coalesces only inserted collinear seam split vertices.
2. `repair_grip.py` extends the retained hand with digit articulation and uses
   supported skin-landmark IK, then bakes the held prop's position AND rotation.
3. `finish_v025.py` regenerates terrain-aware support using `motion.py`, adds
   quantized irregular blinks and partner reactions through `performance.py`,
   bounded gaze, forest detail and shallow camera arcs. Held props must be
   rebaked after performance/body changes.
4. `repair_character_faces.py` adds Lili's local oral/eye support from retained
   V024 edges and applies the central eyelid clearance modifiers. Local fur is
   experimental and must be reviewed; do not treat it as restored original fur.
5. `repair_hand_contact.py SOURCE REGISTRY NEW_OUTPUT` applies `contact_fit.py`
   to the opening's left-hand grasp. The reusable function accepts a body, rig,
   prop, side and contact frame. It requires verified linear skinning and a
   closed prop, bounds corrections to 12 mm, and drives the corrective from grip.
6. `repair_aperture.py SOURCE NEW_OUTPUT` applies `aperture.py` to Mark's retained
   connected lids. It preserves the closed pose and source-connected outer ring.

Each repair CLI refuses to overwrite its input or an existing candidate. Always
run Blender with `--python-exit-code 1`; Blender's default exit code can otherwise
hide Python failures. Inputs are explicit native sources, never a rebuilt cast.

## Independent checks

- `tests/audit_v025_native.py SOURCE REGISTRY REPORT` evaluates every native
  frame: foot target/ankle agreement, stationary support, actual seam-edge
  adjacency, evaluated seam continuity and outer oral topology.
- `tests/audit_finger_collision.py SOURCE REGISTRY REPORT` uses closed prop
  surfaces and three ray directions for sampled hand-vertex containment. Zero
  inside vertices is not a proof of collision-free triangle sweeps.
- `diagnostic_cameras.py` creates separate front-to-side face, grasp and gait
  sources without changing the story source cameras or original audio.
- Pure timing tests: `PYTHONPATH=production python -m unittest discover -s
  production/animation_system/tests -p 'test_*.py'`.

Use `ops/v025-native-source-artifacts.json` and `CONTINUE.md` for exact inputs,
SHA256 values, reports and outstanding issues. `ops/v025-diagnostic-render-jobs.json`
records provider IDs and budget reservations; never restart a completed or
uncertain submission. The final short diagnostic selection is 22 seconds, not
132 seconds, and cannot establish full story-animation visual approval.

## Current visible rejection reasons

Mark's eye rings have visible surface/color transitions; Lili's eyelid fur has
an artificial radial pattern and deep sockets. The scarf still behaves rigidly.
Finger opposition, release/placement, speech acting and whole-body naturalness
need further visual work. Numeric seam/support passes are necessary but do not
waive these issues. A full V025 movie and downstream feature production remain
behind the visual quality gate.
