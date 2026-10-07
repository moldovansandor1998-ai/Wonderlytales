# Current Hungarian recording checkpoint

The V010 packed recording is stale relative to the current Studio recording.
This reversible fork replaces it with the actual current first dialogue:
`Hallod? Ropogós az egész erdő.`

Source Blender SHA256:
`50096838c515bff320cb61d66027f9d26ff1028d34fef6dc44c1625f422783be`

Current MP3 SHA256:
`fb467588f48ffb37da24f49d27cef583d4cdf48c826ade1e4430dab901a7ef29`

The Studio's independent transcription returned Hungarian (`hun`) and the
expected words. This is evidence of text/language agreement for this one
recording, not a performance approval for the entire episode. Further external
transcription of other recordings was blocked by automatic approval review;
do not bypass that rejection or assume it authorizes a batch.

`rebind_mark_recording.py` keeps the body/facial drivers and non-speech acting,
removes stale guessed vowel channels, retimes the retained expression tracks,
and derives jaw opening from the new recording's amplitude. It packs only the
current audio and saves a new file. Both input hashes are required. Its output
directory must be new.

`verify_mark_current_recording.py` reopens the output and validates packed audio
bytes, frame range, evaluated lip displacement, actual jaw rotation and silent
tail closure. It checks actual geometry rather than only properties.

The recording decodes to 3 seconds of PCM. The technical preview is 96 frames,
24 fps, with a 0.5-second lead and tail. This remains a 480×480 draft. No
validated phonemes/visemes, polished geometry, approved character master,
finished intro or finished episode are claimed.

The full current package has 131 recordings, all fully decoded. Its measured
MP3 duration sum is 317.910202 seconds. A separate V002 script/timing checkpoint
rebinds the unchanged dialogue to current storage keys and hashes. It excludes
the old in-story title scene and requires the fixed 360-frame intro before the
story. The assembled draft estimate is 29279 frames (1219.958333 seconds),
subject to moving animatic and acting review. This is not a rendered runtime.

Binary source/output files are saved separately from Git. The old V001 timing
and V010 character remain untouched and must not be used with the new audio.
