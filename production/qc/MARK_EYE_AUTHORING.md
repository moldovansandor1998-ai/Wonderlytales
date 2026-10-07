# Márk eye authoring fork

`author_mark_eye_controls.py` creates a separate draft from the existing native
Márk V007 Blender body asset. Source SHA256 is pinned because the eye landmarks
are specific to that geometry. It rejects later revisions instead of recutting
them. The original file is never overwritten.

The script locally subdivides the socket region, removes the baked eye surface,
builds independent sclera, brown iris and pupil meshes, and adds conforming lids
with two Blink shape keys. Lid color is sampled from the existing atlas into
corner color attributes to avoid crossing unrelated UV islands. A head mount
preserves bone orientation; a child gaze control rotates the eyes independently.
The original skin modifier and body weights are retained.

Controls on `CHAR_MARK_BODY_DRAFT`: `gaze_yaw` and `gaze_pitch` in degrees, and
`blink` from zero to one. A 48-frame / 24 fps mechanical test is keyed into the
scene. The default command renders three 640×640 comparison states, not the
whole animation or an episode. Frames 1, 9 and 18 show neutral, gaze and blink.

```bash
BLENDER_PATH=/path/to/blender python3 scripts/run-blender-checked.py -- \
  -b -t 2 --python production/qc/author_mark_eye_controls.py -- \
  /path/to/CHAR_MARK_V007_BLENDER_BODY_DRAFT.blend /path/to/eye-draft
```

This is an authoring prototype. Socket contour, lids and matching materials
require visual review from several camera angles. There is no mouth interior,
jaw, lip shapes, facial expression system, groom, or speech synchronization.
`facial_ready`, `lip_sync_ready` and `production_approved` remain false. Do not
substitute this asset into the live episode or consider the series opening
produced solely because the eye controls work.
