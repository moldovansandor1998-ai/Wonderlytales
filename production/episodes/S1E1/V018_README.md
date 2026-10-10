# Csodakapu: native 60-second quality test

The new production target is a cinematic Hungarian 3D episode. The development
test preserves the six established Tripo characters and the accepted V016 voice,
music and ambience performances. The accepted dynamic intro is retained separately.
The first-episode title in the existing Supabase project is now Csodakapu.

The test covers episode seconds 243–303 at 24 native frames per second: forest
approach, an authored run insert, seven lines spoken by four characters, gate
opening, sparks, reflected light and two gravity-driven stone chips contacting
the actual terrain. It is a development render, not a cinema-quality approval.

Authoring scripts, in order:

1. `build_quality_test.py -- ROOT prepare` uses the existing native story look.
2. `refine_character_acting.py -- ROOT PREP.blend ACTING.blend` evaluates
   distance-driven foot plants, gradual supported turns, blinks and head acting.
3. `build_quality_test.py -- ROOT finish` makes the editable 1–1440 frame scene.
4. `finalize_quality_scene.py -- ROOT` fixes Zizi's occluded camera and authors
   gradual gate light and 96 Hz gravity/terrain-contact simulation.
5. `extract_quality_contacts.py -- ROOT` writes measured foot-control events.
6. `add_quality_reaction.py -- ROOT` reuses Márk's accepted Hungarian gasp at
   11.5 seconds and adds a reaction close-up. Carrying-wrist IK is released
   temporarily in that close-up to prevent the hoodie covering his mouth.
7. `mix_quality_test.py ROOT` layers those footsteps, stone contacts and the
   cached reaction over the accepted Hungarian master, then normalizes audio.
8. `embed_quality_audio.py -- ROOT` packs the exact 60-second mix in the source.
9. `export_native_review.py -- SOURCE.blend REVIEW.glb 1 1440 --full-rate`
   exports evaluated native rig/morph animation with exact camera/emission data.
10. `render_native_review.py REVIEW.glb picture.mp4 --size 1920 1080` creates
   the **draft** GL review at native Full HD, with 1440 evaluated frames.
   This pass does not reproduce native Cycles point lighting, DOF or volumetrics.
11. `render_quality_proofs.py -- ROOT` produces native Cycles review stills.

The trial uses actual 3D geometry, skin deformation and animation. There is no
image-to-video substitution. Native meshes are packed into the delivered Blender
sources; source archives are separate from this git repository.

The Studio can dispatch immutable native scenes to the existing GPU handler using
`RENDER_WORKER=native-runpod`. The separate native endpoint and a verified RunPod
job cost ceiling are still required before a live paid render. Each worker job
contains at most 360 consecutive Full HD or greater frames. The handler verifies
source and clip checksums, frame counts and full video decoding. Native QC always
includes the acting, facial, lip-sync and contact checks, even when omitted from
the requested profile. Unavailable checks remain warnings, preventing FINAL_READY.

Known unfinished work: sole/contact and deformation approval, independent eye
gaze, detailed facial expressions, verified Hungarian phoneme lip sync, complete
character/object collision handling and final cinematic lighting. IK end-point
accuracy alone does not prove natural acting. Whole-episode export is held behind
the mandatory quality test; the episode has not been marked complete.

The supplied YouTube reference was country-restricted in the available browser.
No direct visual comparison with that film has been claimed. No new Tripo credit
spending or new paid render service was activated for this iteration.
