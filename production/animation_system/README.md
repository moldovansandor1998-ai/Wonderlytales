# WonderlyTales reusable native animation system — V021

Development infrastructure. No master or acting clip has professional quality
approval. Consult the measured QC reports; a successful encode is not a passing
animation review.

- `build_masters.py`: six versioned native Blender collections, anatomy-specific
  controls, IK feet/paws, independent jaw and eyes, replacement oral quad meshes,
  shape-key visemes/expressions, and 78 reusable Blender Action assets.
- `build_scene.py`: validates a declarative scene and consumes locked master and
  Action assets; bakes routed locomotion, world-space contacts, speech, gaze,
  blinks, interactions and camera cuts into a reproducible Blender scene.
- `lipsync.py`: verified-recording hashes and audio-aligned Hungarian character
  timings, Hungarian digraph grouping and silence/coarticulation. These are
  orthographic audio timings, not artist-approved phonetic boundaries.
- `spec.py`: validates scenes and compiles real 40/60-minute timelines with
  content-addressed, bounded render jobs. Synthetic timeline fixtures verify
  capacity; they are not a finished feature screenplay.
- `jobs.py`: durable SQLite queue, atomic leases, expiry, bounded retries,
  stale-worker rejection, immutable inputs and SHA-verified cached outputs.
- `render_review.py` / `review_server.py`: uses actual Blender-evaluated meshes,
  skinning, facial shapes and cameras. Fast OpenGL review lighting is explicitly
  labeled; it is not final Cycles lighting. Reports native ankle target error,
  stance drift, edge stretch and finite geometry.
- `media.py`: complete decoding/frame-rate verification, checked concatenation,
  speech/music/contact-triggered effect mix and muxing.
- `worker.py`: resumable bounded review rendering, verification and assembly.

Run contracts/queue/motion tests:

```sh
PYTHONPATH=production python -m unittest discover -s production/animation_system/tests -v
```

Author masters (one time) and compile a scene:

```sh
blender -b -t 4 --python-exit-code 1 --python production/animation_system/build_masters.py -- ORIGINAL.blend OUTPUT_DIRECTORY
blender -b -t 4 --python-exit-code 1 --python production/animation_system/build_scene.py -- MASTER.blend asset_registry_V021.json scene.json COMPILED.blend
```

Render/resume an episode review:

```sh
PYTHONPATH=production python -m animation_system.worker --project OUTPUT_DIRECTORY --episode episode.json --blender /absolute/path/blender --python /absolute/path/python --chunk 360
```

Python for the review worker needs numpy, moderngl, Pillow and ffmpeg/ffprobe.
Blender 4.5 LTS is used for the tested native authoring path. Master .blend files,
voice assets and generated renders are distributed separately from source code.

Still required: artist-approved welded facial/body retopology and anatomical
skin weights; polished hand/prop and quadruped interaction clips; explicit
collision/intersection testing; production audio direction and final lighting;
GPU Cycles worker integration; complete >=40-minute screenplay and scene data;
end-to-end long-film rendering and visual approval. The Studio UI is not yet
wired to this native scene compiler. Do not release reviews as finished films.
