# V022 facial continuity checkpoint

Development only. No professional film or character approval is granted by a
successful structural check. V021's six masters and 78 Action assets are retained.
Only Mark's restored skin, mouth boundary and upper-body bindings are revised.

The master is distributed with the V022 Blender checkpoint, outside git. The
source V021 master must be the later driver-fixed file with SHA-256
`2840932b51f97780e3e6bdfd85cdd812cf1df2f36ecefb734b94a35cd25bb082`,
provided in the accompanying V021 base-source checkpoint. The earlier exported
V021 master is not sufficient. The original Mark GLB must have SHA-256
`0d3ffde042f173a0f999dcc71d835c196e978a06685268b1eab005da7e3419ee`.

```sh
blender -b -t 4 --python-exit-code 1 --python production/animation_system/repair_mark_seam.py -- MASTER_CAST_V021.blend asset_registry_V021.json OUTPUT_DIRECTORY CHAR_MARK_TRIPO_DRAFT.glb
blender -b -t 4 --python-exit-code 1 --python production/animation_system/check_seam_native.py -- OUTPUT_DIRECTORY/MASTER_CAST_V022.blend OUTPUT_DIRECTORY/seam_QC_V022.json
blender -b -t 4 --python-exit-code 1 --python production/animation_system/render_seam_native.py -- OUTPUT_DIRECTORY/MASTER_CAST_V022.blend OUTPUT_DIRECTORY/proofs
blender -b -t 4 --python-exit-code 1 --python production/animation_system/build_scene.py -- OUTPUT_DIRECTORY/MASTER_CAST_V022.blend OUTPUT_DIRECTORY/asset_registry_V022.json OUTPUT_DIRECTORY/MARK_30S_V022.script.json OUTPUT_DIRECTORY/MARK_30S_V022.blend
```

The repair restores the original Tripo skin, cuts a connected convex perimeter,
orders it with a capped angular correction, then binds 12 lip loops to the actual
150 source boundary vertices. Shape deltas and weights agree at the seam. The
mouth axis follows the original face rather than V021's offset control axis.
Continuous neck/head weights replace the inherited discontinuity. The native
test measures 81 combined viseme, jaw, head and expression poses, and the review
renderer measures the evaluated correspondence every frame. Tests are evidence
about the specified boundary and outer triangles; they do not certify all oral
self-intersections, contacts, acting or Hungarian phonetic accuracy.

V020's cached Rhubarb trial can be imported only with both source checksums.
Its method is explicitly marked unverified development phonetics. Existing
V021 Hungarian recordings retain their original audio hash and measured timing.
No new voice recording, Tripo task or paid service is required by these commands.

For bounded queue execution and restart:

```sh
PYTHONPATH=production python -m animation_system.worker --project OUTPUT_DIRECTORY --registry asset_registry_V022.json --episode episode_60s_V022.json --blender /absolute/path/blender --python /absolute/path/python --chunk 360 --worker-only --max-jobs 1
PYTHONPATH=production python -m animation_system.worker --project OUTPUT_DIRECTORY --registry asset_registry_V022.json --episode episode_60s_V022.json --blender /absolute/path/blender --python /absolute/path/python --chunk 360 --output WonderlyTales_V022_60mp_diagnosztika.mp4
```

The queue verifies actual native scene/master hashes and fully decodes output
before accepting each job. Missing/corrupt outputs are recovered. Preview output
is GL shading and is blocked from final film release. Native Cycles images are
the separate visual reference. The Studio UI does not launch this native worker.

Still required: eliminate the inherited eye/eyelid seams and polish lip sculpt,
teeth, jaw and neck deformation; solve the other five characters' facial
boundaries; review Hungarian lip timing and acting; production locations, lights,
effects and sound mix; a real 40–60 minute screenplay retaining the accepted
opening; approved native final-render capacity and end-to-end feature validation.
The measured 21-minute story draft must never be padded to satisfy film duration.
