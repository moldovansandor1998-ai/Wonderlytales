# Incremental live replies and gift interruption

The previous production trace spent 5,274 ms in the model request before starting
speech. The new `Accept: application/x-ndjson` path streams complete, validated
Hungarian sentences from the model into a single ElevenLabs WebSocket session.
The same request carries turn metadata, incremental MP3 chunks and the final
dialogue. The original response contract remains available for older clients.

The selected speaker and name are deterministic. Existing coherence, repetition,
length and unrelated-pizza checks still apply. No partial words, hidden reasoning,
JSON framing or generic filler are spoken. An invalid reply can be repaired once
only before any speech was submitted. There is no repair/replay after speech starts.

The existing model and low reasoning setting are retained. Streaming requests ask
for priority service; actual service tier and token usage are logged. Current
catalog prices (2026-10-14) are $4/M input, $5/M cache writes and $20/M output.
The 8,000-byte input ceiling plus framing and at most 800 output tokens fit the
existing $0.06 reservation. Oldest history entries are removed if necessary; the
current comment and character rules are never truncated. Non-streaming calls keep
the standard tier. Daily budget/authentication/origin checks remain in place.

Speech connection setup overlaps model preparation. A ready gift's video and
local sound effects start before freshly generated donor speech. The saved
10–199 point begging voice still uses local playback. During preparation the
same model request continues while up to two gifts play. During comment playback
a gift cancels the comment, waits for cleanup, then runs next without overlapping
voices or regenerating the interrupted reply. Interrupted replies count towards
the show's response limit. Already-running gift scenes finish normally.

The displayed first-audio latency now starts when an event enters the browser
queue, including queue wait. It does not claim to measure TikTok broadcast delay.
Server logs separately report first complete sentence, first audio bytes and
total processing time. Browser playback and real TikTok delivery are separate
verification steps.
