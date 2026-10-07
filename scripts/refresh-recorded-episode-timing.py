"""Rebind an episode draft to current recordings, measure and validate every file.

Usage: python this.py SCRIPT PACKAGE_ROOT ACTIONS OUTPUT_DIR
Keeps the original script, archive and timeline intact. The fixed intro is
external to the story timeline and always precedes it. No animation is made.
"""
import hashlib
import importlib.util
import json
import math
import subprocess
import sys
from pathlib import Path

script_path, root, action_path, out = [Path(p).resolve() for p in sys.argv[1:]]
assert not out.exists(), 'Use a new checkpoint directory.'
script = json.loads(script_path.read_text())
package = json.loads((root / 'manifest.json').read_text())
actions = json.loads(action_path.read_text())
assert package['script'] == script['script_version'] and package['status'] == 'DIALOGUE_RECORDINGS_DRAFT'
recordings = {r['id']: r for r in package['dialogue']}
assert len(recordings) == len(package['dialogue']) == script['dialogue_lines']
used = set()
measurements = []
for scene in script['scenes']:
    for beat in scene['beats']:
        if beat['kind'] != 'DIALOGUE':
            continue
        identity = beat['recording_id']
        assert identity not in used
        used.add(identity)
        item = recordings[identity]
        assert (item['text'], item['character']) == (beat['text_hu'], beat['character'])
        assert item['scene'] == int(scene['scene_code'][-3:])
        path = (root / item['file']).resolve()
        assert path.is_relative_to(root) and path.is_file()
        probe = json.loads(subprocess.check_output([
            'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
        duration = float(probe['format']['duration'])
        assert math.isfinite(duration) and duration > 0
        assert len(probe['streams']) == 1 and probe['streams'][0]['codec_type'] == 'audio'
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'null', '-'], check=True)
        beat['audio_storage_key'] = item['path']
        beat['recording_status'] = 'CURRENT_RECORDING_DRAFT_REQUIRES_REVIEW'
        measurements.append({'id': identity, 'audio_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                             'duration_sec': duration, 'decoded': True})
assert used == set(recordings)
# The old draft placed a variable title inside the cold open. The user's newer
# fixed 15-second opening supersedes it, without changing any story dialogue.
intro_scenes = [s for s in script['scenes'] if s['title_hu'] == 'FŐCÍM']
assert len(intro_scenes) == 1 and all(b['kind'] == 'ACTION' for b in intro_scenes[0]['beats'])
script['scenes'] = [s for s in script['scenes'] if s not in intro_scenes]
actions.pop(intro_scenes[0]['scene_code'])
script.update(audio_review_required=True,
              audio_recordings_status='CURRENT_131_RECORDINGS_MEASURED_NOT_PERFORMANCE_APPROVED',
              spoken_audio_duration_sec=sum(m['duration_sec'] for m in measurements),
              recording_package_sha256=hashlib.sha256((root / 'manifest.json').read_bytes()).hexdigest(),
              source_script_sha256=hashlib.sha256(script_path.read_bytes()).hexdigest(),
              series_intro={'duration_sec': 15, 'fps': 24, 'frames': 360,
                            'placement': 'BEFORE_STORY', 'fixed_master_required': True,
                            'only_variable': 'episode_number', 'master_created': False})
out.mkdir(parents=True)
updated_script = out / 'episode_script_current_recordings_DRAFT.json'
updated_actions = out / 'story_action_durations_DRAFT.json'
updated_script.write_text(json.dumps(script, ensure_ascii=False, indent=2) + '\n')
updated_actions.write_text(json.dumps(actions, ensure_ascii=False, indent=2) + '\n')
module_path = Path(__file__).with_name('compile-episode-timing.py')
spec = importlib.util.spec_from_file_location('episode_timing', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
timeline = module.compile_timing(updated_script, root / 'manifest.json', root, updated_actions)
timeline.update(timeline_scope='STORY_EXCLUDING_FIXED_INTRO',
                fixed_intro_frames=360, assembled_draft_frames=timeline['total_frames'] + 360,
                assembled_draft_duration_sec=timeline['draft_duration_sec'] + 15,
                audio_performance_approved=False)
(out / 'beat_timeline_current_recordings_DRAFT.json').write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + '\n')
(out / 'recording_decode_QC.json').write_text(json.dumps({
    'count': len(measurements), 'all_decoded': True, 'recordings': measurements,
    'language_review_complete': False, 'production_approved': False}, indent=2) + '\n')
print(json.dumps({k: v for k, v in timeline.items() if k != 'scenes'}, ensure_ascii=False))
