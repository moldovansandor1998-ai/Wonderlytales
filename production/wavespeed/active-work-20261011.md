# Latest: character voices and required postproduction, 2026-10-11

Only WonderlyTales was changed; Castora and every other project are out of scope.
Production main d1a6ad83b2fcb4310c8845ec1f88ad74ec1bb7f0 reached READY
(deployment dpl_CNAiKVsa33tmNMy1XH4LSpz1xRMA). Signed-in live studio verified at
https://wonderlytales.vercel.app/ai-video.

Implemented video -> fixed character speech -> WaveSpeed InfiniteTalk lip sync
-> FFmpeg sound mix -> user review -> next-scene generation gate. Both UI and
server enforce the gate. Reference images and all existing raw footage remain.
Old TTS generation button was replaced with direction to the postproduction panel;
legacy endpoint also refuses old unactivated character voices. Pending new voice
activation blocks paid spoken postproduction. No paid lip-sync job was submitted.

HU/EN variants retain distinct script, recording, mix, approval and export state.
ALL 60 English script drafts were prepared through the live UI; success message
confirmed. These drafts need per-scene language review and voices, not approval
on the user's behalf. Changed Hungarian source can create editable empty English
lines; they must be filled before approval. Intro CTA is included in both languages;
its first four speech-free music seconds can be looped with crossfades to replace
old speech without discarding the music. No new motion video was generated.

Live FREE mix of story scene1 succeeded: asset
2142e401042e79e090ada3ed8c16f634337edec9948f05f7ba0e8b85e55dac31.
Browser decoded final MP4 at 1920x1080, 10s, readyState4, no media error.
User approval remains pending. Seven raw cards were completed when observed
(intro + six story scenes); the user may keep generating separately. Do not assume
older counts in this document are still current.

Lip sync is provider-native 720p and then fitted into the 1080p final output;
the UI explicitly discloses this. Animal muzzle quality remains UNVERIFIED live.
User review is mandatory. Audio/video fingerprint invalidates approval if the
source, trims, language, lines, voice IDs, recordings or mix change. Mix-only edits
reuse a matching completed lip-sync video. Uncertain paid requests never auto-retry.
Full-episode export assembles six groups and one final MP4 per language only after
all 60 current scene variants are approved; the full movie does NOT yet exist.

Five new ElevenLabs voice designs are prepared, three samples each (15 total):
Morzsi -> Felix, Lili -> Mira, Potty -> Nera, Zizi -> Tilda, Mark -> Oszkar.
Canonical Hungarian accents are preserved in app voice names. All are original
adult synthetic character voices with HU/EN identity prompts, V002 names.
Old voices are still active and have NOT been renamed or removed. First attempted
save refused with VOICE_REJECTED_VOICE_LIMIT_REACHED. Official subscription now
confirmed voice_slots_used=10, voice_limit=10. The UI shows exact 10/10 capacity.

BLOCKER: to activate new designed voices, permanently remove ONLY the five old
allowlisted WonderlyTales voices. Browser permanent-deletion guidance requires
an action-time confirmation. User has authorized redesign/replacement, but has
NOT yet explicitly confirmed irreversible removal after this consequence was
identified. DO NOT click the five confirmation checkboxes/replacement buttons
until that confirmation. Other voices (including Dora and Zsofi) must stay.
Existing recorded MP3s remain intact; deleted old voice IDs cannot be restored.
The replacement backend validates exact old ID, name/prefix, current character
mapping, capacity and edit quota, stores old metadata, and claims durably before
calling deletion/create. All preview samples are private and retained.

Budget policy retained existing daily $200 ceiling and timezone. Added per-service
ceilings: voice_design .50, wavespeed_lipsync .66, translation .05 USD.
Five design reservations are ceilings, not a statement of provider billed cost.
No subscription, credit top-up, or new motion-scene generation was purchased.

Verification: 39 targeted tests passed for the full feature, production build,
typecheck and diff check passed. Following final small fixes, typecheck and 14
relevant episode/postproduction/charge tests passed again. Local FFmpeg render,
concat and intro music-loop checks passed. Both Next post routes trace the
ffmpeg-static binary. Live 1080p mixing, all 60 English drafts and all 15 preview
players verified. Full episode and animal lip sync remain unverified as noted.

Next: obtain ONE confirmation covering the five permanent replacements, activate
and verify each V002 mapping, then run a bounded live spoken lip-sync test with
the new character voice and review actual output. User approves finished scenes.

---

# Live verification update

Episode workshop released on main (feature commits 376ff4b6 and 19d3a016).
Production deployment dpl_HfjqavyjMGEuyUhpHJA9T47aceYx reached READY.
Verified signed-in website: https://wonderlytales.vercel.app/ai-video.
All 60 cards load, five cast refs are registered; finished intro decodes at
1920x1080, 10s, readyState4, no media error. Previous clip final-frame extraction,
chunk upload and persisted selection succeeded; original doorway image then
restored FREE through the new image-history button. Its approval stays pending.
37 targeted checks now cover the new restored-image case in addition to earlier
36 tests; typecheck passed. Vercel production builds passed.

One real image test for shot4 cost $0.04, task eacffe3ddee94fab9a0b4636329f81b4,
app image job cda13254-04d3-4736-bb66-7fb75df675a0. COMPLETED, private image SHA
b91f21ebdab203de2d83e49ed7facffa6735362f419624c156875336bb7af3e9.
QA found an unintended zebra ANIMAL and changed background archway. Preserved
this output, set shot4 review needs-work, imageApproved false, documented issues.
Provider prompt clarified Hungarian zebra=pedestrian crossing and preservation of
fixed architecture for future jobs. No automatic paid retry and NO video job
was submitted. User should continue with shot3's prepared doorway image first.
The episode is a production plan and source workshop, not an assembled 10min MP4.

---

# Superseding direction: episode workshop, 2026-10-11

The user approved the finished opening, five character reference portraits and the
original story direction. Latest request: prepare the WHOLE first episode on the
website; user generates the videos. Do not submit paid video jobs on their behalf.
Only WonderlyTales may change. Castora and all other projects remain out of scope.

The episode workshop now contains 60 persistent cards: 10s existing intro + 58
story shots + 10s outro, a 600s PLANNED timeline. This is not a finished episode.
The story follows the accepted speeding-car footage, a stolen brass document
cylinder and property fraud targeting Rézrakpart. Félix is a thief; Mira is a brown
rabbit detective, Néra a marten dealer, Tilda a pangolin mechanic, Oszkár a squirrel
courier. Earlier otter/other unapproved character concepts are superseded.

For each scene: editable image/video prompts, selectable canonical cast,
automatic first-open reference image (max $0.04), alternative previous video final
frame without image generation, explicit image approval, quote and USER-started
video, character dialogue, continuity/review/trim notes, preserved variants and
manual visual analysis (max $0.02). Frame transfer uses authenticated same-origin
streaming video and canvas; private provider/R2 URLs are not exposed in the page.
Images/video claims are permanent and conditionally written; uncertain submits do
not retry with a new charge. Original footage is archived within the same owner's
R2 prefix. ElevenLabs MP3s remain separate: visible speech requires lip-sync and
final mixing, not yet automatically implemented in this episode UI.

Data seeded only inside Wonderly's existing AI-video owner prefix:
- 60 episode-scene records, five reference records;
- completed final intro master: a1709001-2026-4011-8010-000000000000;
- original clips: af642e9e-f142-432e-bc56-2c9ed19f09a9 and
  7b0d342b-28fe-4292-b387-153d728a7cb8;
- scene 3 doorway starting image is prepared but awaits USER approval;
- no story video 3 or later and no outro video has been generated.

Supabase vruxiyvlynbivzjuijed budget service ceilings added: wavespeed_image .04,
wavespeed_analysis .02. Existing daily $200 ceiling and every other service cap
were preserved. No new purchases, subscriptions, credits or video submissions.

Verification before release: 36 targeted tests passed (episode/data, approval,
source ownership, concurrency, uncertain retries, price/budget, auth, voice locks),
production build including typecheck/lint passed. React review: expensive legacy
studio only mounts on demand; cast previews lazy-load. Live release verification
is recorded separately in this session. Local seeder has no embedded credentials.

---
Historical notes below are superseded by the current direction above.

# Active direction, 2026-10-11 11:39 Asia/Saigon

WonderlyTales only. Do not modify Castora or any other project.

User asked for actual 10s intro/outro, five existing custom ElevenLabs voices,
scene image generation, video analysis and reuse/adaptation of usable footage.
Then added character reference portraits and multi-character selection per scene.
Latest steering: reject the miniature map/city title concept; show a new title
image here and explain the animation before spending on video generation.

Five voice assignments SAVED in scoped Titokváros DB, preserving old rows:
- Félix: Morzsi, tWNlc7uUtaorMxxrhH9s
- Mira: Lili, jcrKkDTF93Hvb8jBABwM
- Néra: Pötty, gvuelryL3NskaN44p9vz
- Tilda: Zizi, 8ik405hgdHADnz9lglMf
- Oszkár: Márk, vmhWRuUG7LqpLLPY9sM1
Selection based on existing character voice descriptions, not listening approval.

Actual first 20s canon: speeding car arrives/brakes; Félix runs away. The tram
is background. Keep both clips, adapt the story. Working episode title suggestion:
1. rész – A rossz kanyar. This title has not been explicitly approved.

Title artwork V002 generated and shown: rooftop Félix on right, modern warm city,
large golden TITOKVÁROS on left, WonderlyTales above, episode caption below.
Generated image is a design preview / ending composition. Titles should be separate
editable layers in actual video. Do not animate baked episode text.
Source image: /workspace/scratch/77d35433dfb7/generated_images/exec-baee0577-d86c-46b2-a990-34cb581237db.png
Project copy: /workspace/scratch/77d35433dfb7/felix-ai/Titokvaros_focim_latvanyterv_V002.png
User has not yet reacted to V002. No intro/outro paid task was submitted.
Old rejected title image: exec-084b651f-3257-451c-aa45-a236d4e7b1e2.png.
An earlier rooftop image request was rejected by imagegen output safety (no category
detail); do not retry that same rejected request. Subsequent different designs succeeded.

LOCAL DRAFT ONLY, not deployed: creative-shared.ts, creative.ts, media.ts and routes
for reference cards, multi-reference Seedream 4.5 images, Molmo2 video analysis,
private R2 archives and manual continuity notes. Storage/provider extensions made.
Permanent conditional claims and ETag writes intended to prevent paid retries.
Still needed: UI components, test coverage, budget service additions (image .04,
analysis .02), reference registration, live tests, deploy, actual intro/outro.
Do NOT say these local feature drafts are live or complete.
Voice resolver now excludes TEMPORARY_WORK_TRACK/RETIRED; verify existing tests.
Watch streaming download timeout and archive CAS preservation before deployment.

Production remains e449809f8c4a2c448f420a8cefdb6900ae0623a6.
WaveSpeed balance last observed 9.15 USD; no new paid video/image API calls this turn.
Browser tab 6 has rejected-map title prompt/quote, UNSUBMITTED. Replace before any
future generation; do not click its current generate button.

The proposed 10s opening plan: 0–2 city reveal and producer name, 2–5 move through
city following light, 5–7 Félix turns/smiles on terrace, 7–10 title/episode caption
with breathing room. Original short adventurous orchestral motif; same motif in outro.

Latest 11:44 Asia/Saigon: user accepted the V002 artwork and asked to receive a starting image. A clean V003 was generated from V002 with title overlays removed, retaining Félix and the skyline. Shown in chat. Local production asset: /workspace/scratch/77d35433dfb7/felix-ai/Titokvaros_focim_tiszta_kezdokep_V003.png. Source: /workspace/scratch/77d35433dfb7/generated_images/exec-4f2c05cd-e7e8-4f88-800b-4ec011d8aa85.png. No paid WaveSpeed task submitted. Previous V002 acceptance supersedes the earlier pending-reaction note.

## Superseding update: actual opening completed, 2026-10-11

User approved the opening and requested Félix turn toward camera and say
“Iratkozz fel a csatornára!” in his assigned voice.

Actual final deliverable:
`/workspace/scratch/77d35433dfb7/felix-ai/WonderlyTales_Titokvaros_Focim_1080p.mp4`
10.000 seconds, 240 frames, 1920×1080, H264/AAC, 48kHz stereo, 8,861,391 bytes.
SHA256: `8301e3b6a0218ebeb781060e3ed6f35b1018ce1e19d98d44c2e4d856d3ee7eda`.
Library: `libfile_00a4ca76d6248191890a515e5435b198`.

Sources produced without buying credits:
- Kling3 Pro motion: app job `17b4c321-f801-44ad-bea2-d8351a8ccf4c`, provider
  `4d2ef10794994db09e7ef3087e4c45d6`, $1.68.
- Assigned Félix ElevenLabs voice `tWNlc7uUtaorMxxrhH9s`, dialogue
  `fb24ce7235d7e7cf653f9b64b13556fcb1c48defc82043dcb6677fa4de765893`.
  Exact requested Hungarian sentence, immutable provenance and timing saved.
- LongCat Avatar1.5 speaking performance: `f1e4ee25bb5143d1a3ba39a75206a6ff`,
  $0.40, completed. Budget reservation `0f98fcab-dda3-4b06-bcba-c5d2a69b59f8`.
- Final mixed-video speech verification: quoted $0.02, reservation
  `afc656e7-57d7-46f1-826c-97dcbeb9f52b` (ceiling $0.03).

Reusable edit scripts: `scripts/title-production.py`, `scripts/render-title.py`.
Never persist API keys or signed input-payload JSON in git. Helper reads the
WaveSpeed key ephemerally from stdin and claims each paid submission once in R2.

Adaptations: successful first 8s of city motion retimed to 5s; speaking performance
continues its exact frame at 8s. The avatar model center-cropped a 1312×739 resize
to 1312×704 at y=17. Crop was measured and restored during compositing to avoid
a framing jump. Dialogue starts at 5.65s. Titles and episode caption are separate
layers; can change future episode metadata without new video generation.

QA: final duration/resolution/frame count verified; whole-clip contact sheet and
four speaking-face samples per second visually inspected. Mouth, ears, blinking,
and hand gesture move. Stable main face/outfit/environment and no obvious extra
limbs in sampled frames. A minor jacket-pocket detail changes during the avatar
performance. Speaking footage is the 720p tier upscaled to the 1080p deliverable;
do not claim native Full HD throughout or perfect frame-by-frame identity.
No human listening approval has been claimed.

Sources and final manifest are archived only within the Wonderly R2 owner prefix
`ai-video/wavespeed/v1/76197ae3-b002-44b2-8e50-e884ee1b34bd/title/`.
Final master metadata: `masters/<final-sha256>.json`.
Final bytes: `inputs/<final-sha256>.mp4`.

Production website remains e449809f8c4a2c448f420a8cefdb6900ae0623a6.
No creative/reference UI draft was deployed. Outro and those website features
are still pending; do not claim completion. No other project was modified.

Speech QA completed: full-video Whisper returned an unrelated Amara subtitle
hallucination and was not accepted as a valid check. The exact final soundtrack
speech excerpt (5.3–7.8s) was separately checked with Whisper Turbo, task
`ce91245f8c114bab84190a444c3d6880`, and returned exactly
“Iratkozz fel a csatornára!” with Hungarian language probability 1.
Additional verification cost $0.0021; budget reservation
`f27a59a1-9337-4d78-b3c8-7f0ac460c790`, ceiling $0.01.
Final file stayed unchanged and matches the Library SHA above.
