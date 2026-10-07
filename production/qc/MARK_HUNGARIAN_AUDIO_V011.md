# Márk Hungarian audio and native face draft V011

The V010 recording used eleven_multilingual_v2, which does not support Hungarian. Its decode and timing checks did not establish intelligibility. V010 audio is rejected; use the V011 assets recorded with explicit language_code=hu.

Márk D001 uses eleven_v3. Scribe v2 independently detected Hungarian and returned the exact normalized words “Hallod? Ropogós az egész erdő.” without a script or language hint. Lili and Pötty samples also matched. Morzsi and Zizi still require manual pronunciation review; all 131 clips are decoded and current-model cache keys match, but intelligibility is not approved for all lines.

The canonical Library asset identities and SHA-256 hashes are in ../authoring/MARK_expression_authoring_V011_DRAFT.json. The clean face base contains no rejected V010 speech. The acting file packs the corrected MP3 and textures, with a sound strip beginning at frame 13.

The native lids use nine poses. Vertex depth is bounded over both neighboring interpolation segments. A 101-position check found no tested vertex penetrating the eye surface. This does not certify shading or artistic quality.

The 97-frame, 24-fps video uses an RMS jaw envelope and manually estimated vowel poses. Phoneme alignment remains unverified. Fresh reopen checks matched all 97 native control frames; the decoded video speech correlates with the source MP3 at 0.9896.

Use animate_mark_face_hu_v011.py with its SHA-pinned face and audio inputs, render_mark_face_hu_v011.py for isolated frame renders, and the check scripts for native controls and eyelid clearance. All production, facial-ready and lip-sync-ready flags remain false. The studio character asset has not been promoted.
