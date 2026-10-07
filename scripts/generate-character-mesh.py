"""Generate one reusable DRAFT mesh from a versioned character reference.

This authoring step never generates shots or marks a mesh production-ready.
Dependencies: gradio_client, httpx[socks]. Uses Microsoft's official demo.
"""
import argparse
import hashlib
import inspect
import json
import os
from pathlib import Path
import shutil
import struct
import time


def inspect_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("GLB is truncated")
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError("Invalid glTF 2 binary")
    json_length, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A or 20 + json_length > len(data):
        raise ValueError("Invalid GLB JSON chunk")
    model = json.loads(data[20:20 + json_length])
    if not model.get("meshes") or not model.get("materials"):
        raise ValueError("Generated asset must contain a mesh and materials")
    return {
        "meshes": len(model["meshes"]),
        "materials": len(model["materials"]),
        "textures": len(model.get("textures", [])),
        "skins": len(model.get("skins", [])),
        "animations": len(model.get("animations", [])),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--character", choices=["CHAR_MARK", "CHAR_LILI"], required=True)
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=1978)
    parser.add_argument("--resolution", choices=["512", "1024", "1536"], default="1024")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    reference_id = args.character + "_mesh_input"
    reference = next((x for x in manifest["assets"] if x["id"] == reference_id), None)
    if reference is None:
        raise ValueError("The versioned manifest has no isolated input for this character")
    image_hash = hashlib.sha256(args.image.read_bytes()).hexdigest()
    if image_hash != reference["sha256"]:
        raise ValueError("Reference checksum differs from the recorded design input")
    if args.output.exists() or args.output.with_suffix(".json").exists():
        raise FileExistsError("Create a new draft filename; existing assets are immutable")
    from gradio_client import Client, handle_file
    args.output.parent.mkdir(parents=True, exist_ok=True)
    token = os.environ.get("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN is required; configure the secret before starting authoring")
    parameters = inspect.signature(Client).parameters
    token_argument = "token" if "token" in parameters else "hf_token"
    if token_argument not in parameters:
        raise RuntimeError("Unsupported gradio_client authentication interface")
    client = Client("https://microsoft-trellis-2.hf.space", verbose=False,
                    **{token_argument: token},
                    httpx_kwargs={"timeout": 120},
                    download_files=str(args.output.parent / "downloads"))
    started = time.monotonic()
    print("Starting official TRELLIS.2 authoring session", flush=True)
    client.predict(api_name="/start_session")
    prepared = client.predict(handle_file(str(args.image.resolve())), api_name="/preprocess_image")
    print("Reference prepared; generating one static reusable mesh", flush=True)
    client.predict(handle_file(prepared), args.seed, args.resolution,
                   7.5, .7, 12, 5., 7.5, .5, 12, 3., 1., 0., 12, 3.,
                   api_name="/image_to_3d")
    print("Mesh generated; extracting textured GLB", flush=True)
    outputs = client.predict(300000, 2048, api_name="/extract_glb")
    source = Path(outputs[0] if isinstance(outputs, (tuple, list)) else outputs)
    info = inspect_glb(source)
    shutil.copyfile(source, args.output)
    metadata = {
        "character": args.character,
        "reference_version": manifest["version"],
        "reference_sha256": image_hash,
        "source": "https://huggingface.co/spaces/microsoft/TRELLIS.2",
        "seed": args.seed,
        "resolution": args.resolution,
        "status": "DRAFT_UNRIGGED",
        "production_approved": False,
        "rig_ready": False,
        "facial_ready": False,
        "elapsed_seconds": round(time.monotonic() - started, 2),
        **info,
    }
    args.output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata), flush=True)


if __name__ == "__main__":
    main()
