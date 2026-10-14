# Faster comment and gift reactions

Production traces showed two serial model calls per comment (roughly 8–20 seconds together) while streamed speech started in around one second. The client blocked gifts behind both model calls, and also imposed an eight-second small-gift cooldown.

- A valid comment now uses one model request with the existing internal coherence review and contextual prompt. Invalid output can still receive one bounded repair; provider, credit and authentication failures never retry.
- During comment preparation, at most two queued gifts play first. The original comment request continues; no cancelled/repeated AI spend and no overlapping voices. A reply slot is reserved for the already-paid comment. Stop aborts both preparation and playback.
- The studio no longer imposes a small-gift cooldown. Rose bursts still coalesce; gifts costing 10–199 per unit are kept separate from 1–9 point gifts. A rose streak never becomes a high-value gift by multiplication.
- The appended `gag-beg` clip is six seconds: Isti kneels before the chair and begs toward the camera. Both the video and the exact Hungarian Isti line are saved and preloaded. The donor appears in the gift caption; the reusable spoken line omits the donor name. Existing asset IDs are preserved.
- The targeted preparation button submits only the new clip and voice, once. Starting the show never generates missing paid media. Until both are saved, low gifts retain their short spoken fallback; they cannot play an unrelated premium clip.

Verification: 70 targeted tests, TypeScript, and production build passed. Tests cover gift-before-AI ordering, no overlapping playback, fairness, abort and late failure, unchanged storage IDs, caching, gift tier boundaries, and single-pass model spending. Browser rehearsal and generated-clip inspection are separate from a real TikTok LIVE check.
