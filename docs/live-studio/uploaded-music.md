# Uploaded music only, repeating playlist — 2026-10-14

The live studio no longer instantiates the generated instrumental music bed.
Show startup, NPC preview, DJ preview, and mood changes use only songs from the
existing browser music library. The instrumental toggle has been removed.
No uploaded music or saved mood tags were changed.

The mixer plays unused songs in each round. Once every playable uploaded song
has played, it clears the round history and starts at the first playable file
in library order. A one-song list waits for that song's actual end. Failed
files remain excluded, so an empty or entirely broken library stays silent.
Manual stop prevents another round. Speech ducking and crossfades remain.

Validation: 16 DJ tests passed, including multi-song repetition, one-song
repetition without early overlap, manual stop, and no retries of broken files.
TypeScript and the production build (including workflow validation) passed.
Production commit: `66b79f3e066533ad944c071f7e5452f64e48df69`.
Deployment: `dpl_J11Ka3zG85VkkrBahHFjYMMtXgMt`, READY with production alias.

Browser verification confirmed the uploaded-only and repeat labels, removal
of the instrumental toggle, and a DJ preview that stays stopped when the test
browser has no songs. The user's phone-local uploaded files are not accessible
from this browser; their playlist was not played end-to-end here. No TikTok
connection or public live broadcast was started.
