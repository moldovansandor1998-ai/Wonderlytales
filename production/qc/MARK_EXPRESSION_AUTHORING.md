# Márk native expression authoring — V010 draft

This is a reversible authoring fork of the V009 Blender asset. It adds
`mouth_spread`, `mouth_press`, `smile`, `brow_raise` and `brow_worry` controls,
while retaining `jaw_open`, `mouth_round`, gaze, blink and native body rig.
It smooths the jaw weight gradient, conserves the sum of body weights, and
limits fitted surface offsets to 0.0015 native units. The limit is essential:
an unconstrained fitted surface can move the lips behind the mouth cavity.
Inner-aperture ray hits on the back of the head must never drive the lip rim.

The source V009 asset is pinned by SHA256 and preserved unchanged. The
`refine_mark_face.py` entry point creates a new file and retains existing
drivers by clearing only the animation action. Clearing all animation data
would also remove the native jaw and eye drivers.

`check_and_render.py` reopens the authored file for each of seven poses,
measures actual evaluated geometry displacement, checks body weight sums and
packed textures/audio, and renders the result. Scripted driver expressions
are explicitly invalidated after the baseline measurement to avoid stale
evaluations. The host must confirm the output PNG and report exist, because
Blender may exit zero after a Python exception.

`animate_mark_face.py` adds the original RMS-driven jaw, manual estimated
vowel cues, blink, gaze, smile, eyebrows and slight native head movement.
It uses the recorded Hungarian line “Hallod? Ropogós az egész erdő.”
The estimated vowel centers have NOT been verified against phonemes.
`phoneme_alignment`, `alignment_verified`, `production_approved` and
`quality_gate_passed` remain false. This is an acting draft, not final lip sync.

The labeled 91-frame render is 480×480 at 24 fps, with recorded audio offset
by 0.5 seconds. Every frame uses a freshly reopened scene. Full MP4 decode,
frame count and audio rate are checked after assembly.

Visible limitations remain: lip corner and lower-face shading, eye socket
contour, hair/groom, validated Hungarian alignment, other characters' faces,
final environments, intro and full episode animation. The asset is not
promoted to the live Studio and does not replace a production master.

The series intro remains one fixed 15-second animation/music master, with
only the episode number changing. No final intro is produced by this work.

Source asset: `libfile_a6e99af61eb8819185ed97dc4ce31efe`.
SHA256: `d4478514f6ff3087b1b5e4ac4f2fe6dbe72e705e38cac8ec3f958ed4fd8e1f50`.

```bash
blender -b -t 2 --python production/qc/refine_mark_face.py -- V009.blend OUT
blender -b -t 2 --python production/qc/check_mark_expression_pose.py -- OUT/CHAR_MARK_FACE_V010_DRAFT.blend POSES happy
blender -b -t 2 --python production/qc/animate_mark_face.py -- OUT/CHAR_MARK_FACE_V010_DRAFT.blend envelope.json ACTING
python production/qc/render_mark_expression_test.py BLENDER ACTING/CHAR_MARK_ACTING_V010_DRAFT.blend envelope.json VIDEO
```
