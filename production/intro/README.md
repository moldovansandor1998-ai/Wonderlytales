# Constant opening

The user specified one reusable 15-second opening for every episode, with only
the episode number changing. `series_intro_V001.json` records the requirement
and an unproduced shot proposal. It does not identify an approved intro master.

After an actual master is produced, use the same pinned SHA256 with
`scripts/assemble-episode-with-intro.py`. The script validates a 360-frame,
1920×1080 / 24 fps intro, overlays only an integer episode number from frame
288 through frame 359, then concatenates the episode at frame 360. Both inputs
must have audio. No automatic upscaling, retiming, or substitution is allowed.
The command creates a frame-count and checksum receipt after full decode.
It rejects existing output paths and a changed master checksum.

```bash
python3 scripts/assemble-episode-with-intro.py \
  --intro /path/to/fixed-intro-master.mp4 \
  --intro-sha256 PINNED_MASTER_SHA256 \
  --episode /path/to/episode-content.mp4 --number 1 \
  --font /path/to/Hungarian-capable-font.ttf \
  --output /path/to/Csodakapu_S1E1_complete.mp4
```

Integration verification used generated solid-color and sine-wave fixtures,
not a produced cartoon: 15-second intro plus 1-second content yielded 384
frames / 16 seconds, with content beginning at frame 360 and full decode
passing. The introductory checksum mismatch path was also checked. These
fixtures are scratch tests and are not production deliverables.

The forest lighting script in `production/qc/render_forest_lookdev.py` loads
actual native Márk and Lili drafts into a reusable, procedural draft forest
scene. It renders a single 1080p Cycles frame. This improves the basis for
lighting/material review; it does not implement facial acting, grooming,
finished environments, or the 15-second opening animation.
