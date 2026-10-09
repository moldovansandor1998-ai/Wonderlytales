# S1E1 V017 — native animation review

V016's 15-second intro and 21:02.250 Hungarian sound edit were accepted as the
production basis. The acceptance record applies to those deliverables only.

V017 authors an editable native Blender animation blocking pass for the entire
story: SC001, SC003, and SC004–019. SC002 reuses the accepted moving intro.
The speaking cast is unchanged. Bogyó has dog reactions only.

This is a review cut, not a finished production cartoon. Final acting,
hand/prop contacts, eye gaze and blinks, phoneme articulation, and final lighting
remain unapproved. The camera follows the cloth during the pickup, and source
jaw controls are driven by the accepted audio. Envelope and word-timed mouth
motion must not be represented as verified phoneme alignment.

## Reproduce

1. Supply the packed native V017 scenes from the delivery source bundle, along
   with the accepted V016 audio and intro. The bundle contains the exact audio
   and intro needed for assembly.
2. `prepare_speech_motion.py` prepares 131 dialogue and 12 reaction tracks.
3. `build_opening_scene.py`, `build_fragment_pickup_scene.py`, and
   `build_story_blocking.py` create native camera, skeletal and prop animation.
4. Run Blender 4.5.3 with `export_native_review.py -- SOURCE.blend TARGET.glb`.
   Evaluated camera cuts and animated emission are retained in a JSON sidecar.
5. `render_native_review.py TARGET.glb OUTPUT.mp4 [first_native_index last_native_index]`
   requires Python, NumPy, Pillow, ModernGL and a working EGL context. This is a
   draft GL renderer; procedural material approximations and simplified skin
   normals are not the final Cycles lighting pipeline. It renders native skeletal
   and morph motion at 12 fps, delivered on twos at 24 fps.
6. Concatenate the exact picture segments, insert the accepted 360-frame intro,
   and mux the unchanged V016 full audio and Hungarian subtitles.

| Picture | Delivery frames | Duration |
|---|---:|---:|
| SC001 | 1600 | 66.666667 s |
| Accepted intro / SC002 | 360 | 15.000000 s |
| SC003 | 1642 | 68.416667 s |
| SC004–019 | 26692 | 1112.166667 s |
| Full review | 30294 | 1262.250000 s |

The source bundle is an addendum to V015/V016, not a replacement of their source
packages. Packed native scenes preserve the reusable cast and environment assets.
Do not merge old render caches after a native source changes: compare SHA-256.
