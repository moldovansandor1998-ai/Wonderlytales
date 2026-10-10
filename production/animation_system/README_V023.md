# V023 diagnostic continuation

No master or full film is approved. See CONTINUE.md for exact source and next step.

Reusable measured fixes: `motion.support_shift` and continuous sole heading at clip
changes; Hungarian audio-bound grapheme grouping; `fit_support` feasibility solver.
The latter remains opt-in diagnostic authoring because better IK exposed worse skin.
`repair_motion_transitions.py` writes a separate candidate. Broad skin diffusion is
explicitly disabled after comparative QA showed a regression. Zizi's head/jaw mouth
binding removes sampled outer flips but does not reconstruct a watertight body seam.

Evidence: ops/native-baseline-v022-20261010.json, native-comparison-v023-20261010.json,
master-structure-v022-20261010.json. These are Blender 5.0.1 measurements on 81 selected
frames; they cannot certify unsampled motion, native 4.5.3 compatibility, acting,
self-intersections or final lighting. V022 production masters remain unchanged.

R2 checkpoint keys under native/S1E1/V023/:
- GATE_60S_V023_candidate.blend: first skin-diffusion experiment, rejected.
- GATE_60S_V023_motion.blend: continuous pelvis + Zizi head/jaw binding, skin unchanged.
- GATE_60S_V023_support.blend: Lili body support experiment, rejected for skin regression.
- baseline_full.json: historical name; content explicitly states 81 sampled frames.
- candidate_qc.json, candidate_repair.json, support_qc.json, support_fit.json.
- master_structure_V022.json: all six structural checks, no motion approval.
- diagnostic_motion_frame_721.png: small 8-sample CPU Cycles proof, not final render.

Never silently replace the master with an experimental .blend. Rebuild from frozen
V022 using the committed scripts, fix skin and validate all frames before promotion.
