# Continuity, voices and permanent gallery — 2026-10-11

User accepted story clips 1 and 2; later clips need regeneration. All existing and
future images/videos, including replaced and rejected versions, must remain reusable.

Live actions in this conversation:
- User deleted the five old voices. We activated all five saved V002 designs,
  one at a time: Félix, Mira, Néra, Tilda, Oszkár. UI verified ACTIVE, 10/10 slots.
  No voice deletion by us. Earlier deletion-confirmation blocker is resolved.
- All five canonical video elements now show active. Recovery refreshed Félix;
  no duplicate paid registration or motion video was launched in this follow-up.
- Story clip 2: no dialogue; preserved original audio at 1.0, prepared the free
  Full HD copy, recorded the user's explicit acceptance. It unlocks clip 3.
- Clip 3: exact final frame taken from accepted clip 2. Saved a continuous
  0–2 / 2–4 / 4–8 / 8–10 second action plan, Félix only, Mira offscreen until
  the next clip; dialogue offset 3 sec. Existing media remains in history.

Branch changes:
- Strict last-frame timestamp guard, visual rejection cannot approve postproduction.
- Recover only an exact character + owned reference match from provider history;
  retain provider IDs and accept null/structured results; merge latest main fixes.
- Permanent owner-scoped /gallery: cursor pagination for every image, original
  video job and MP4 post asset, including detached/replaced intermediates.
- Automatic archive on completion even in free-form video studio. Existing remote
  clips are saved on gallery load; failures are visible and retry without generation.
- Download, copy video id for scene attachment, reuse image, or continue any saved
  video from its last frame. New project work shares the same persistent gallery.
- No media deletion feature and no automatic paid generation.

Validation: 54 targeted tests passed (gallery, provider, elements, episode,
postproduction, voices). TypeScript and production build passed. Browser validation
of the new gallery awaits the branch preview; actual motion/lip-sync quality cannot
be guaranteed without a new user-started clip.

Publication blocker: automatic approval review rejected direct push to main because
explicit authorization to mutate the default branch was absent. Do NOT bypass it
with an alternate main write or production deployment. Draft PR #5 is the concrete
reviewable result; request explicit merge/publication permission after ready.

## Automatic finished-video pipeline and batch request (latest steering)

User additionally requested one-click finished video (no timing work), automatic
speaker recognition, and up to ten consecutive scenes with review after the queue.
Implemented on this branch, NOT yet published to main:

- Workflow SDK 5.2.0 durable orchestration, sequential persisted steps, owner-scoped
  single-worker CAS claims. Only authenticated same-origin POST starts a pipeline.
  All service ceilings are reserved under the user's existing budget before any
  worker runs; no session/refresh token or service-role credential enters a workflow.
- One generate action runs motion -> video-based character recognition -> frozen
  ElevenLabs voices -> measured-duration timing -> left/right lip-sync -> ducked
  ambience/final MP4. Only the current completed final is shown by default; manual
  postproduction lives under repair settings, raw assets remain in Gallery.
- Recognition maps canonical species/costume to screen position and usable face
  visibility intervals. It fails closed on uncertain identity or crossing sides.
  Current lip-sync provider supports at most TWO visible speaking characters per
  shot; this is preflight-checked. Three lines/offscreen voices remain supported.
  No claim of infallible character recognition or lip-sync quality.
- Automatic timing fits complete recordings in script order and available visible
  windows, with a pause and trim margins. It does not truncate or overlap speech.
  Speech that cannot fit requests shorter text instead of charging another take.
- Batch selection permits 1–10 consecutive story scenes. Each starts only after the
  preceding mixed MP4 is READY; server ffmpeg extracts its actual last decoded frame.
  Batch consent allows provisional continuity WITHOUT asserting quality approval.
  The first source still requires the prior accepted frame; later review stays pending.
  Prior clips/images/post assets remain preserved when new variants are assigned.
- Provider task IDs survive malformed results, and replayed start attempts cannot
  repeat a paid task. Errors pause the saved run instead of regenerating automatically.
- Preview requires a separate app login. No paid motion, analysis, TTS dialogue or
  lip-sync request was launched to exercise the new pipeline in this conversation.

Validation now: 66 targeted automated tests plus one real ffmpeg final-frame
comparison passed (67 total). Production build generated both Workflow handlers;
ffmpeg is included in the handler trace. Typecheck passed. Latest build still has
non-fatal Next 14 warnings for newer optional Workflow config keys.
