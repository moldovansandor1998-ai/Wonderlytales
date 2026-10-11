# WonderlyTales WaveSpeed integration

Entry: `/ai-video`. GitHub: `moldovansandor1998-ai/Wonderlytales`.
Vercel project: `prj_sWV1Mv57OR2X5uI3Qm4aHW42PSz2` (`wonderlytales`).
Supabase: `vruxiyvlynbivzjuijed`. No other project is part of this integration.

## Activation

Add `WAVESPEED_API_KEY` as a server-only Production Secret in this Vercel project
and redeploy. The existing R2 settings and Supabase Studio authorization are reused.
The application only reports key presence; it cannot display or save a key.
Use the Connection refresh button: it calls the provider balance API, without
buying credits or starting a generation. A valid funded key is required for a live
provider test. No WaveSpeed key was available when this integration was deployed.

## User flow

1. Upload a JPEG/PNG (10 MB maximum); 3 MB chunks respect server request limits.
   Hash, dimensions and file signature are validated; images are private per user.
2. Choose a Félix preset or write a prompt, 5/10 seconds, audio and optional end
   image. Inputs retain their original aspect ratio. The supplied 1536×1024 source
   is 3:2, so no claim of native 16:9 is made without inspecting the actual output.
3. Request a live price using the exact input. Balance, quoted price, hard per-job
   ceiling and existing atomic daily budget are checked before submission.
4. Submit once. The R2 record claims the operation before the budget reservation
   and provider POST. Never silently retry unknown submissions or failed jobs.
   Poll the saved task ID; closing the page does not lose it. Provider error bodies
   are not exposed. Conditional state updates prevent stale poll regression.
5. Play/open/download the actual MP4. Provider URLs can expire; download promptly.
   They are not archived as permanent MP4 files by this version. Last-frame
   continuation uses the last decoded browser frame and requires CDN CORS; if
   unavailable, upload an externally extracted last frame instead.

Each generated scene remains unverified and not production-approved. Hungarian
pronunciation, lip sync, identity, limbs, motion, audio and output dimensions need
actual review. This integration does not automatically concatenate/encode the
30s final film, upscale it, or claim a professional-quality result.

## Cost and failure contract

Allowlisted model: `kwaivgi/kling-v3.0-pro/image-to-video`. 5 or 10 seconds only.
Docs checked 2026-10-11: 10s $1.12 silent or $1.68 with sound. Live quotes override
the displayed estimate but cannot exceed $1.68. The budget policy service key
`wavespeed_kling` reserves $1.68 per attempt, including shorter/discounted attempts.
This is a conservative Studio ledger, not an account-wide provider billing cap.
Reservations are not automatically refunded after failures. External purchases,
manual provider jobs and provider pricing changes are outside this ledger.

If submission becomes uncertain, inspect the WaveSpeed task history before a new
explicit attempt. Do not delete its R2 claim. A network/storage interruption between
provider acceptance and saving the task ID can require manual reconciliation.

## Verification

`npm test -- tests/wavespeed.test.ts tests/wavespeedAccess.test.ts tests/budget.test.ts tests/runwayBenchmark.test.ts tests/titokvarosRender.test.ts`
`npm run typecheck` and `npm run build`.
Contract tests mock provider responses; they are not evidence of a generated video.
See `ops/wavespeed-integration.json` for deployment and live verification evidence.

## Primary API references

- https://wavespeed.ai/docs/docs-api/kwaivgi/kwaivgi-kling-v3.0-pro-image-to-video
- https://wavespeed.ai/docs/pricing-api
- https://wavespeed.ai/docs/check-balance
