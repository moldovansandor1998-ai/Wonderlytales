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
