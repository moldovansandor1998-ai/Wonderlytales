# Mark V013 film look development — DRAFT

This checkpoint keeps the existing fixed native character and current Hungarian audio. It adds 1,774 geometric hair strands, separate skin and hair materials, eye material detail, a narrower lid contour, soft three point lighting and a native 1920×1080 render. It is not production approved and does not match the approved V004 reference quality yet.

The V012 cheek Smooth modifier opened seams because the native mesh has disconnected seam vertices. V013 removes that modifier and its group; a reduced resolution render verified the cause before the full render. Matte hair roughness is 0.5. Native body vertex count stays 270,365.

The remaining work is substantial: sculpt the oversized hair masses into a believable groom, rebuild eye sockets and eyelid transitions, repair the lip corners, and author animation friendly facial topology. Added fine strands do not constitute a complete groom. Do not promote this draft to a character master or render the full episode with it.

Reproduce V012 using author_mark_film_lookdev.py and the SHA checked current-audio V011 source. Finalize V013 using finalize_mark_film_lookdev.py. Run verify_mark_current_recording.py on the reopened V013 scene to verify packed audio and jaw/lip motion. That test does not prove phoneme alignment, facial quality or production readiness.

All 131 episode recordings received independent Studio speech-to-text review: 115 normalized Hungarian text matches, 16 flagged results. Flags include short-utterance language classification and compound spelling differences as well as potential missing or changed words. No flagged audio was replaced on the basis of ASR alone. Complete rows are in speech_review_20261008.json. Listening review is still required.
