# TECH_AB_V001 — technology comparison, not V026

Latest user instruction: investigate before buying. No subscription, credits,
new paid job or production approval is authorized by this checkpoint.

Read TECHNOLOGY_REVIEW_HU.md for the evidence and decision. scene.json is a
24-second INPUT contract. Neither requested A/B movie exists yet. V025's
22-second diagnostic reel must not be relabelled as either experiment.

## Existing preparation

- `scripts/prepare-tech-ab.py`: reads existing R2 HU takes and SHA-checked V024,
  creates identical 24s 48kHz audio stems and four shot specs. No render/TTS.
  CLI requires `--credentials`, `--v024-movie`, `--output` (absolute paths).
- `scripts/calculate-tech-ab-costs.py`: writes costs.json, no network/billing.
- `src/lib/providers/runway-benchmark.ts`: isolated Seedance 2.5 API boundary.
  Fixed 1080p durations, image/audio references, persistent R2 claim/state,
  once-only submit, resume/poll, fail-closed verified budget gate. Not wired
  into the production UI/factory; no live Runway Dev generation performed.
- `scripts/assemble-tech-ab.py --help`: accepts actual A and B 24s 1080p files,
  verifies frame count/full decoding, muxes the identical SHA-checked audio,
  writes review samples. No looping, padding or speed changes to fake duration.
  A 1080 pixel array alone does not prove native generation resolution.

## Gates before later execution

1. Obtain accessible reference footage; record observation separately from inference.
2. Build the actual new A performance/rig test. Preserve original meshes and HU audio;
   Lili requires a quadruped rig. Existing procedural gait is not mocap evidence.
3. Make approved cast/environment reference images from permitted project sources.
   Existing rejection concerning the original Library Lili export still applies;
   do not retry it through another route. See the historical CONTINUE checkpoint.
4. After explicit purchase/cost approval: establish the chosen provider's account,
   model availability, current price, API credential and verified genvideo budget.
   Runway app credits and Runway Dev API credits are separate. Never repurpose the
   existing native RunPod endpoint as a video-generation endpoint.
5. Submit only after the durable claim and budget reservation succeed. On unknown
   POST outcome, reconcile manually; never auto-resubmit. Resume known task IDs.
6. Download outputs promptly into new trial-specific keys, record SHA/provenance,
   inspect every shot at real speed and in close/side views. An API SUCCEEDED
   state is not a quality decision. Preserve rejected outputs and actual costs.
7. Only if both 24s routes are reviewed, run the proposed separate 12-shot continuity
   stress test. Neither test has passed yet; do not start feature production.

Verification completed: TypeScript typecheck; 14 focused provider/budget tests;
Python compile; common audio checksum/duration/peak checks; negative assembler
check correctly rejects the old 22s reel. No paid end-to-end test was run.

Local input checksums, proposed (NOT uploaded) R2 keys and access/budget state are
recorded in `ops/tech-ab-v001-status.json`. Automatic approval review blocked the
private input upload; explicit payload/destination approval is required. No
alternative export of that input package was performed. Runtime checkpoint files containing signed provider
URLs or credentials must never be committed.
