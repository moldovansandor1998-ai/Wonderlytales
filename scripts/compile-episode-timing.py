"""Compile an unapproved beat timeline from measured dialogue and explicit action timing.

This does not generate shots, animation, visemes or a final episode. All intervals
are half-open frame ranges; audio is never stretched to reach the target runtime.
"""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path


def compile_timing(script_path, recordings_path, audio_root, action_path, fps=24):
    script = json.loads(script_path.read_text())
    recordings = json.loads(recordings_path.read_text())["dialogue"]
    actions = json.loads(action_path.read_text())
    by_id = {r["id"]: r for r in recordings}
    if len(by_id) != len(recordings):
        raise ValueError("Duplicate recording ID")
    frame = 0
    scenes = []
    used = set()
    audio_seconds = 0.0
    for scene in script["scenes"]:
        code = scene["scene_code"]
        action_index = 0
        start = frame
        beats = []
        for index, beat in enumerate(scene["beats"], 1):
            entry = {"beat_id": f"{code}_B{index:03d}", "kind": beat["kind"],
                     "start_frame": frame, "animation_status": "NOT_BLOCKED"}
            if beat["kind"] == "ACTION":
                seconds = actions[code][action_index]
                action_index += 1
                if not isinstance(seconds, (int, float)) or not 0 < seconds <= 30:
                    raise ValueError(f"Invalid action timing for {code}")
                entry.update(direction_hu=beat["direction_hu"], timing_source="DIRECTOR_ESTIMATE",
                             duration_frames=math.ceil(seconds * fps), camera_status="NOT_BLOCKED")
            elif beat["kind"] == "DIALOGUE":
                identity = beat["recording_id"]
                if identity in used:
                    raise ValueError("Recording used twice")
                recording = by_id[identity]
                if (recording["text"], recording["character"], recording["path"]) != (beat["text_hu"], beat["character"], beat["audio_storage_key"]):
                    raise ValueError(f"Recording/script mismatch: {identity}")
                path = (audio_root / recording["file"]).resolve()
                if not path.is_relative_to(audio_root.resolve()):
                    raise ValueError("Audio path outside package")
                result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)], check=True, capture_output=True, text=True)
                duration = float(json.loads(result.stdout)["format"]["duration"])
                if not math.isfinite(duration) or duration <= 0:
                    raise ValueError("Invalid recorded duration")
                audio_seconds += duration
                used.add(identity)
                # Six-frame anticipation and eight-frame reaction are draft acting allowances.
                audio_frames = math.ceil(duration * fps)
                entry.update(character=beat["character"], text_hu=beat["text_hu"],
                             recording_id=identity, audio_storage_key=recording["path"],
                             audio_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                             measured_audio_duration_sec=duration, timing_source="FFPROBE_PLUS_DRAFT_ACTING",
                             audio_start_frame=frame + 6, audio_end_frame=frame + 6 + audio_frames,
                             duration_frames=6 + audio_frames + 8, lipsync_status="NOT_CREATED")
            else:
                raise ValueError("Unsupported beat")
            frame += entry["duration_frames"]
            entry["end_frame"] = frame
            beats.append(entry)
        if action_index != len(actions[code]):
            raise ValueError(f"Unused action durations in {code}")
        scenes.append({"scene_code": code, "title_hu": scene["title_hu"],
                       "start_frame": start, "end_frame": frame, "beats": beats})
    if used != set(by_id) or len(used) != script["dialogue_lines"]:
        raise ValueError("Dialogue package coverage is incomplete")
    return {"schema": "WONDERLY_BEAT_TIMING_V1", "episode": script["episode"],
            "status": "DRAFT_TIMING_REQUIRES_MOVING_ANIMATIC", "fps": fps,
            "script_sha256": hashlib.sha256(script_path.read_bytes()).hexdigest(),
            "total_frames": frame, "draft_duration_sec": frame / fps,
            "target_duration_sec": script["planned_duration_sec"],
            "measured_dialogue_duration_sec": audio_seconds,
            "recorded_dialogue_count": len(used), "animatic_verified": False,
            "render_shots_created": False, "facial_ready": False,
            "scenes": scenes}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for argument in ["script", "recordings", "audio_root", "actions", "output"]:
        parser.add_argument(argument, type=Path)
    args = parser.parse_args()
    timeline = compile_timing(args.script, args.recordings, args.audio_root, args.actions)
    args.output.write_text(json.dumps(timeline, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: value for key, value in timeline.items() if key != "scenes"}, ensure_ascii=False))
