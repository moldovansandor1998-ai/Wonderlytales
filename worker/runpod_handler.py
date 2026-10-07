"""RunPod proxy-preview entry point. Final master assets are not implemented here."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time


def handler(event):
    payload = event.get("input", {})
    shot = copy.deepcopy(payload.get("shot", {}))
    if payload.get("type") != "PREVIEW":
        raise ValueError("FINAL requires locked master assets; this worker supports proxy PREVIEW only")
    from blender_worker import validate_shot
    errors = validate_shot(shot)
    if errors:
        raise ValueError("; ".join(errors))
    required = ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]
    if any(not os.environ.get(k) for k in required):
        raise ValueError("R2 worker configuration missing")
    import boto3
    shot["render"]["quality"] = "PREVIEW"
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix="wonderly-") as tmp:
        source = Path(tmp) / "shot.json"
        source.write_text(json.dumps(shot))
        result = subprocess.run([
            os.environ.get("BLENDER_PATH", "blender"), "--background", "--python",
            str(Path(__file__).with_name("blender_worker.py")), "--", "--input", str(source), "--output", tmp,
        ], capture_output=True, text=True, timeout=840, check=True)
        records = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{"status":')]
        if not records or records[-1].get("renderer") != "blender" or records[-1].get("status") != "SUCCEEDED":
            raise RuntimeError("Worker did not return a real Blender render")
        rendered = records[-1]
        video = Path(rendered["output"]).resolve()
        if not video.is_relative_to(Path(tmp).resolve()) or not video.is_file() or video.suffix != ".mp4":
            raise RuntimeError("Missing or invalid render output")
        # Job IDs prevent concurrent retries from overwriting each other's output.
        import hashlib
        identity = hashlib.sha256(str(event.get("id", "local")).encode()).hexdigest()[:24]
        key = f"renders/{shot['shot_id']}/preview_r{shot.get('revision', 1)}_{identity}.mp4"
        client = boto3.client("s3", endpoint_url=os.environ["S3_ENDPOINT"], region_name="auto",
                              aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                              aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"])
        client.upload_file(str(video), os.environ["S3_BUCKET"], key, ExtraArgs={"ContentType": "video/mp4"})
        elapsed = time.monotonic() - started
        return {"status": "SUCCEEDED", "output": key, "frames": rendered["frames"],
                "durationSec": shot["duration_sec"], "renderSec": rendered["render_sec"],
                "gpuSec": elapsed, "renderer": "blender-storybook-draft-v002" if shot["render"].get("visual_style") == "STORYBOOK_DRAFT_V002" else "blender-proxy", "error": None}


if __name__ == "__main__":
    import runpod
    runpod.serverless.start({"handler": handler})
