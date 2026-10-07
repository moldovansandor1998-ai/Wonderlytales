# Márk native mouth authoring — V009 draft

This reversible fork adds a native `jaw` bone, normalized lower-face weights,
a locally refined physical mouth aperture, conforming lip geometry, recessed
mouth bowl, six upper teeth, and a tongue to the reviewed V008 eye asset.
It is not approved for production. Hair, lid transitions and the mouth contour
still need sculpting and topology work. Brows, cheeks and expression controls
are absent. Other characters still have no reviewed facial rigs.

`jaw_open` (0–1) rotates the native jaw up to 0.25 rad. `mouth_round` (0–1)
controls a separate artist-authored lip shape. Existing `gaze_yaw`, `gaze_pitch`
and `blink` controls remain available. The speech test keeps eyes neutral to
isolate lower-face movement; it is not an acting performance.

The recorded line “Hallod? Ropogós az egész erdő.” drives the jaw through a
24 fps RMS amplitude envelope with a 0.5 s lead-in and 0.5 s tail. Lip rounding
is not inferred from audio. There is no phoneme alignment, and the output must
never be described as finished Hungarian lip synchronization.

The source input SHA is pinned in `author_mark_mouth_controls.py`. Retopology
preserves native UVs and body weights; original triangles and UV samples are
cached before edits so subdivision cannot invalidate texture sampling indices.
The source eye asset is preserved, and the authored file packs its textures
and the recorded MP3.

```bash
python production/qc/prepare_mark_amplitude_test.py RECORDED_LINE.mp3 envelope.json
blender -b -t 2 --python production/qc/author_mark_mouth_controls.py -- EYES.blend OUT envelope.json
blender -b -t 2 --python production/qc/verify_mark_mouth_draft.py -- OUT/CHAR_MARK_MOUTH_DRAFT.blend OUT/mouth_authoring_report.json
python production/qc/render_mark_speech_test.py BLENDER OUT/CHAR_MARK_MOUTH_DRAFT.blend envelope.json OUT
```

Rendering uses a fresh reopened scene for every frame, avoiding the previously
observed stale custom-property driver state during sequential manual renders.
Use a fresh frame directory for each run. The video is labeled ARCMOZGAS-PROBA,
480×480 at 24 fps, with the recorded audio offset by 500 ms. Frame count, fps,
audio sample rate and full video decoding are checked. It is an authoring test,
not a final episode shot or the series intro.

The intro remains exactly 15 seconds, with identical animation and music for
every episode; only the episode number may change. It has not been produced.
This facial asset is not automatically promoted to the live Studio.
