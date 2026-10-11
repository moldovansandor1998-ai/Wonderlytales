# Last-frame continuity follow-up — 2026-10-11

User: continue WonderlyTales / ElevenLabs. Default to the previous final frame;
only deliberate scene endings may start new artwork. Every 10 seconds must
advance the story; Mira must retain the approved brown rabbit identity.

Verified production baseline: 519b74d, Vercel dpl_3h2TkNZeMH5SnfWvuukqzPJVV3UA READY.
Signed-in /ai-video shows seven completed raw videos, zero HU final approvals,
58 planned story clips plus intro/outro. Existing continuous story beats and
frame + canonical-element payload are present. They do not prove visual quality.

This follow-up:
- Reject frame timestamps outside the final 50ms of the approved, trimmed final.
- Visually rejected scenes cannot approve postproduction or unlock their successor.
- Recover uncertain Kling element requests from provider history only when model,
  character name, image origin and exact owner-scoped image path match uniquely.
  Missing/ambiguous history never causes a fresh paid submission.
- Accept null provider outputs/errors; retain a valid provider task ID even when
  another field has an unsupported shape.
- Explain identity/action/last-frame review beside the final video.

Validation: 27 targeted tests passed across episode, postproduction, element and
provider recovery cases; TypeScript passed; production build passed. Existing
Supabase middleware Edge-runtime warning remains. No live lip-sync trial or new
motion video generated. New recovery logic has NOT been exercised in production.

Mira already had ELEMENT_SUBMISSION_UNCERTAIN and no recorded task ID. One Felix
registration was requested with the existing max $0.01 limit; it has the same
uncertain outcome. Do not repeat either paid submission. Nera, Tilda and Oszkar
were not submitted. Recover after the code reaches the appropriate environment;
if history lacks the original inputs, require provider evidence before binding.

Five original ElevenLabs V002 designs remain 15 saved samples, not active voices.
Confirmed 10/10 voice slots. Replacement would permanently remove ONLY:
Morzsi -> Felix, Lili -> Mira, Potty -> Nera, Zizi -> Tilda, Mark -> Oszkar.
Existing MP3s remain. Browser action-time permanent-deletion confirmation is
still required; no voice was deleted or renamed in this follow-up.

Publication: automatic approval review REJECTED direct push to main because the
user had not explicitly authorized a default-branch mutation. Do not bypass this
rejection by an alternate main update or production deployment. A separate branch
and draft PR are the reviewable safe alternative. Ask for main merge/publication
approval along with the separate five-voice deletion confirmation only after the
PR is ready. No new subscriptions, credits or other projects were changed.

Official provider contracts checked:
https://wavespeed.ai/docs/predictions-api
https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-elements
https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v3.0-pro-image-to-video
