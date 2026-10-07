"""Replace a stale packed speech recording and its jaw timing in a new draft.

Blender --python this.py -- SOURCE AUDIO SOURCE_SHA AUDIO_SHA OUTPUT_DIR
This does not infer phonemes or certify acting quality. Preserve the source.
"""
import bpy
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np

source, audio, source_sha, audio_sha, destination = sys.argv[sys.argv.index('--') + 1:]
source, audio, destination = map(lambda p: Path(p).resolve(), (source, audio, destination))
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_sha
assert hashlib.sha256(audio.read_bytes()).hexdigest() == audio_sha
assert not destination.exists(), 'Use a new output directory; never overwrite a draft.'
pcm = np.frombuffer(subprocess.check_output([
    'ffmpeg', '-v', 'error', '-i', str(audio), '-f', 'f32le', '-ac', '1', '-ar', '24000', '-'
]), dtype=np.float32)
assert pcm.size and np.isfinite(pcm).all()
fps, lead_frames, tail_frames = 24, 12, 12
speech_frames = math.ceil(len(pcm) / 1000)
rms = np.array([np.sqrt(np.mean(pcm[i * 1000:(i + 1) * 1000] ** 2))
                for i in range(speech_frames)])
floor, scale = float(np.quantile(rms, .15)), float(np.quantile(rms, .92))
assert scale > floor and scale > .001, 'No measurable speech.'
values = np.clip((rms - floor) / (scale - floor), 0, 1)
values = np.convolve(np.pad(values, (1, 1)), [.2, .6, .2], mode='valid')
values = [0.] * lead_frames + values.tolist() + [0.] * tail_frames
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
assert rig.name.startswith('CHAR_MARK') and rig.animation_data and rig.animation_data.drivers
assert 'jaw_open' in rig and 'mouth_round' in rig
scene.frame_set(1)
# Keep the facial drivers and non-speech expression tracks. Only replace the
# speech channels: old manually guessed vowel centers belong to the old audio.
action = rig.animation_data.action
assert action
for curve in list(action.fcurves):
    if curve.data_path in ['["jaw_open"]', '["mouth_round"]', '["mouth_spread"]', '["mouth_press"]']:
        action.fcurves.remove(curve)
old_end = scene.frame_end
frame_count = len(values)
for curve in action.fcurves:
    for point in curve.keyframe_points:
        factor = (frame_count - 1) / max(1, old_end - 1)
        point.co.x = 1 + (point.co.x - 1) * factor
        point.handle_left.x = 1 + (point.handle_left.x - 1) * factor
        point.handle_right.x = 1 + (point.handle_right.x - 1) * factor
for frame, value in enumerate(values, 1):
    for prop, amount in {'jaw_open': .68 * value, 'mouth_round': 0.,
                         'mouth_spread': 0., 'mouth_press': 0.}.items():
        rig[prop] = amount
        rig.keyframe_insert(data_path='["' + prop + '"]', frame=frame)
for curve in action.fcurves:
    for point in curve.keyframe_points:
        point.interpolation = 'LINEAR'
destination.mkdir(parents=True)
recording = destination / 'Mark_magyar_aktualis.mp3'
recording.write_bytes(audio.read_bytes())
# Remove the stale sound data from this fork, not merely from the movie mix.
if scene.sequence_editor:
    for strip in list(scene.sequence_editor.sequences):
        if strip.type == 'SOUND':
            scene.sequence_editor.sequences.remove(strip)
for sound in list(bpy.data.sounds):
    bpy.data.sounds.remove(sound, do_unlink=True)
strip = scene.sequence_editor_create().sequences.new_sound('HU_CURRENT_RECORDING', str(recording), 1, lead_frames + 1)
strip.sound.pack()
scene.frame_start, scene.frame_end, scene.render.fps = 1, frame_count, fps
scene.render.use_sequencer = False
scene['status'] = 'DRAFT_CURRENT_HU_AUDIO_AMPLITUDE_TIMING'
scene['speech_test'] = 'Current HU recording; RMS jaw only; no validated phoneme lip sync'
scene['audio_sha256'] = audio_sha
scene['phoneme_alignment'] = False
scene.frame_set(1)
bpy.ops.file.pack_all()
output = destination / 'CHAR_MARK_CURRENT_HU_AUDIO_V011_DRAFT.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
manifest = {'status': 'DRAFT_CURRENT_HU_AUDIO_AMPLITUDE_TIMING',
            'dialogue': 'Hallod? Ropogós az egész erdő.', 'fps': fps,
            'audio_path': str(recording), 'audio_sha256': audio_sha,
            'source_sha256': source_sha, 'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'audio_duration_sec': len(pcm) / 24000, 'audio_offset_sec': lead_frames / fps,
            'frame_count': frame_count, 'jaw_values': values, 'phoneme_alignment': False,
            'production_approved': False, 'quality_gate_passed': False}
(destination / 'current_audio_timing.json').write_text(json.dumps(manifest, indent=2))
assert len(bpy.data.sounds) == 1 and bpy.data.sounds[0].packed_file
assert hashlib.sha256(bpy.data.sounds[0].packed_file.data).hexdigest() == audio_sha
print('CURRENT_HU_RECORDING_REBOUND', frame_count)
