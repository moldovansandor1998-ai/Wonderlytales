# Native body motion review

The incomplete local Blender 4.5.3 installation was replaced with the full
verified installation. The repaired executable initializes background Python.
Its SHA256 is `5e15447670804c855fef6033ac9b8fd82696b762095becf0df79b1c2f8034397`.
This checksum describes this Linux build, not other platforms or releases.

Use `scripts/run-blender-checked.py` with `BLENDER_PATH` set to a complete
installation. It checks background Python initialization before forwarding the
job arguments. It does not download executables or fall back to mock renders.

`render_native_body_motion.py` loads the actual packed Blender body drafts for
Márk, Lili, Morzsi, Pötty, Bogyó and Zizi. Its manifest contains character codes
and absolute source `.blend` paths. It excludes static helper meshes and checks
evaluated skinned vertex motion at frames 1 and 7 for each character.

```bash
BLENDER_PATH=/path/to/blender python3 scripts/run-blender-checked.py -- \
  -b -t 2 --python production/qc/render_native_body_motion.py -- \
  /path/to/assets.json /path/to/output
ffmpeg -framerate 12 -i /path/to/output/frame_%04d.png \
  -c:v libx264 -pix_fmt yuv420p /path/to/output/body_motion_DRAFT.mp4
```

Outputs: packed editable scene, 24 frames at 12 fps, measured deformation
report. Review uses CPU Cycles, four samples, denoising, 960 × 360 resolution.
This is a two-second mechanical motion test. The normalized lineup is a review
layout, not the characters' final relative scale or an episode environment.
There is no dialogue, facial rig, lip sync or production approval. Automatic
weights still require deformation review and manual correction before acting.
