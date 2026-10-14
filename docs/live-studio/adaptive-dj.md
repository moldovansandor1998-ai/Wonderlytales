# Adaptive DJ — 2026-10-14

The existing short Ali/Isti dialogue stays unchanged. The music now follows
accepted show events, dialogue emotions and the saved music-gift reaction.

- Calm: 76 BPM; relaxed: 96 BPM. Playful: 104 BPM, brighter chords and light drums.
- Hype: 124 BPM, stronger beat for gifts or a busy comment queue.
- Drama: 112 BPM, sparse melody, low bass and a short downward accent for Isti.
- Musical accents also work over imported tracks. All music ducks during speech.
- Mood cues expire after 12–20 seconds; ordinary speech cannot cancel the
  higher-priority music-gift cue. Tempo changes gradually at bar boundaries.

Imported recordings use two Web Audio media decks with 2.5-second crossfades.
A matching tagged track is preferred, then a universal track, then any remaining
track. A mood-driven change requires at least 30 seconds of the current track;
universal tracks are not interrupted by mood changes. Track-end transitions and
explicit song requests are exempt. Songs are never replayed in the same page
session. Failed tracks are excluded and stalled loads time out after 10 seconds.
STOP aborts pending playback and pauses both decks. No beat matching or automatic
BPM analysis of imported recordings is claimed.

The operator can tag each song and run a standalone DJ sound check without
AI/voice/video generation or a TikTok connection. Up to 30 audio files (100 MB
each) and their mood tags are stored in this browser's IndexedDB. Storage failure
is visible. Device storage clearing or browser eviction can remove these files;
there is no server upload or cross-device sync. Original DESH/T. Danny/Finni
recordings are not bundled or downloaded; the UI says they are still missing.

Validation: 52 targeted Vitest tests, including 19 DJ/director tests covering priority and
expiry, mood selection, crossfade overlap, no-repeat, 30-second hold, track end,
failure recovery, stalled loads, cancellation and gain ducking. Typecheck and
production build passed. Actual TikTok system-audio capture remains a check on
the user's phone.

Web Audio reference: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource

Integration with PR #26 preserves Hungarian comment cues, the 8-second mood cooldown, quiet-period relaxation, existing IndexedDB track IDs and mood tags, manual next-song control and request-list playback. Imported audio also receives gradual mood-dependent filtering through both decks.
