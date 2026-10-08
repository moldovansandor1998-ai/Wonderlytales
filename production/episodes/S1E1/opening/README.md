# S1E1 native opening draft

This is a 25-second, Hungarian-voiced animation blocking draft: a reusable
15-second intro candidate followed by a condensed 10-second SC001 excerpt.
The excerpt contains the first two current recordings. Its 2-second lead-in
is a preview edit, not a replacement for the full episode timing plan.

The six characters retain their native meshes and body rigs. Márk uses the
V013 facial draft. Lili, Morzsi, Pötty, Bogyó and Zizi receive an opaque fur
material pass; their independent facial rigs are still incomplete. Opaque
fur avoids the glowing polygon artifacts seen with subsurface scattering
on the supporting draft meshes. Fine grooming and body deformation still
need artistic work. No production quality approval is implied.

The fixed intro contains the gate, ensemble motion, series titles and an
original procedural music draft. Only the episode number may vary between
future episodes. Its layout and music are candidates, not a locked master.
Do not feed the numbered candidate to the master assembly tool as an
unnumbered, approved reusable intro.

## Reproduce

Use Blender 4.5.3 and Python with NumPy/Pillow plus ffmpeg/ffprobe. ROOT must
contain the materialized inputs (media/native assets are stored separately
from git):

- `episode-assets/forest_lookdev_DRAFT.blend`
- `episode-assets/CHAR_{MORZSI,POTTY,BOGYO,ZIZI}_V008_BLENDER_BODY_DRAFT.blend`
- `mark-film-lookdev-v013/CHAR_MARK_FILM_LOOKDEV_V013_DRAFT.blend`
- `current-episode-audio/` with its manifest and all current recordings

Run these in order, using the absolute ROOT and output directories:

1. `python3 prepare_opening_schedule.py ROOT OUTPUT`
2. `python3 mix_opening_audio.py ROOT OUTPUT`
3. `blender -b --python author_story_props.py -- ROOT/episode-story-props-v001`
4. `blender -b --python build_opening.py -- ROOT OUTPUT`
5. `blender -b --python check_opening_scene.py -- OUTPUT/S1E1_OPENING_ANIMATION_V001_DRAFT.blend OUTPUT/scene_QC.json`
6. `blender -b -t 8 --python render_opening.py -- OUTPUT/S1E1_OPENING_ANIMATION_V001_DRAFT.blend OUTPUT/final_frames 1 600`
7. `python3 finalize_opening.py OUTPUT` (or `--watch` while step 6 runs).

The draft uses 300 unique native phases at 12 phases/s, each exposed twice
in a 600-frame, 24 fps, 1920×1080 MP4. It uses Cycles 4 samples with denoising;
this is a blocking preview, not a final noise/flicker-approved render.
Rendering resumes only from PNGs with a complete IEND trailer. The finalizer
checks every source image, output frame counts, duration, resolution, full
video/audio decode and decoded audio peak before writing `movie_QC.json`.

`SUPPORTING_FILM_MATERIALS_V009_DRAFT.blend` is an appendable object library,
not a standalone scene. The opening and prop-gallery blend files are native
scenes. The opening WAV is packed into the scene's VSE for playback; external
ffmpeg muxing uses the same WAV. The 131-recording ZIP is a versioned snapshot,
not a full-episode sound mix.

## Remaining production work

- Refine Márk's eyelids, eye volume, lip seams, facial topology and grooming.
- Build and verify independent facial controls for all five supporting cast.
- Complete phoneme alignment and Lili mouth movement; Márk's current jaw
  follows an RMS envelope, not verified phoneme poses.
- Author walking, weight shifts, foot contacts, cloth and prop interactions.
- Develop the forest/gate beyond the current schematic masonry draft.
- Use the native broken star, scarf, removable-lid basket and rolling meter
  in later scene blocking; no cloth simulation or complete wheel rig yet.
- Review the previously flagged recordings and continue SC001 beyond D002.
- Complete the remaining 19-scene episode plan; no padded 20-minute export.
