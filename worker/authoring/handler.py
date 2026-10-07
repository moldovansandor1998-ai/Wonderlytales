"""Native TRELLIS.2 authoring. Produces immutable UNRIGGED drafts, never final shots."""
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import struct

PIPELINE = None
MANIFEST = Path('/opt/wonderly/manifest.json')


def checked_reference(payload, manifest):
    character = payload.get('character')
    reference = next((a for a in manifest['assets'] if a['id'] == f'{character}_mesh_input'), None)
    if character not in ('CHAR_MARK', 'CHAR_LILI') or reference is None:
        raise ValueError('No versioned isolated reference for character')
    if payload.get('reference_sha256') != reference['sha256']:
        raise ValueError('Reference identity mismatch')
    if payload.get('reference_version') != manifest['version']:
        raise ValueError('Reference version mismatch')
    resolution = payload.get('resolution', '512')
    if resolution not in ('512', '1024_cascade'):
        raise ValueError('Unsupported authoring resolution')
    seed = payload.get('seed', 1978)
    if type(seed) is not int or not 0 <= seed <= 2147483647:
        raise ValueError('Invalid seed')
    return character, reference, resolution, seed


def inspect_glb(path):
    data = path.read_bytes()
    if len(data) < 20 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('Invalid GLB')
    size, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A or 20 + size > len(data):
        raise ValueError('Invalid GLB JSON')
    doc = json.loads(data[20:20 + size])
    if not doc.get('meshes') or not doc.get('materials'):
        raise ValueError('Missing textured geometry')
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'meshes': len(doc['meshes']), 'materials': len(doc['materials']),
            'textures': len(doc.get('textures', [])), 'skins': len(doc.get('skins', []))}


def author(event):
    global PIPELINE
    payload = event.get('input', {})
    if payload.get('operation') != 'AUTHOR_CHARACTER_MESH':
        raise ValueError('Unsupported operation')
    required = ['HF_TOKEN', 'S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
    if any(not os.environ.get(key) for key in required):
        return {'status': 'BLOCKED', 'error': 'AUTHORING_SECRETS_MISSING', 'mesh_created': False}
    manifest = json.loads(MANIFEST.read_text())
    character, reference, resolution, seed = checked_reference(payload, manifest)
    import boto3
    from PIL import Image
    import torch
    if not torch.cuda.is_available():
        return {'status': 'BLOCKED', 'error': 'CUDA_UNAVAILABLE', 'mesh_created': False}
    client = boto3.client('s3', endpoint_url=os.environ['S3_ENDPOINT'], region_name='auto',
                          aws_access_key_id=os.environ['S3_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['S3_SECRET_ACCESS_KEY'])
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix='wonderly-mesh-') as tmp:
        image_path = Path(tmp) / 'reference.png'
        client.download_file(os.environ['S3_BUCKET'], reference['storage_key'], str(image_path))
        raw = image_path.read_bytes()
        if len(raw) != reference['bytes'] or hashlib.sha256(raw).hexdigest() != reference['sha256']:
            raise ValueError('Stored reference checksum mismatch')
        # First load runs inside the bounded authoring job, not unbounded startup.
        if PIPELINE is None:
            from trellis2.pipelines import Trellis2ImageTo3DPipeline
            PIPELINE = Trellis2ImageTo3DPipeline.from_pretrained('microsoft/TRELLIS.2-4B')
            PIPELINE.low_vram = True
            PIPELINE.cuda()
        image = Image.open(image_path)
        image.load()
        mesh = PIPELINE.run(image, seed=seed, pipeline_type=resolution)[0]
        mesh.simplify(16777216)
        import o_voxel
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices, faces=mesh.faces, attr_volume=mesh.attrs,
            coords=mesh.coords, attr_layout=mesh.layout, voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]], decimation_target=300000,
            texture_size=2048, remesh=True, remesh_band=1, remesh_project=0, verbose=False)
        path = Path(tmp) / 'character.glb'
        glb.export(str(path), extension_webp=True)
        info = inspect_glb(path)
        # Content address prevents an older master being overwritten by a retry.
        prefix = f'assets/characters/{character}/drafts/{manifest["version"]}/{info["sha256"]}'
        meta = {'character': character, 'status': 'DRAFT_UNRIGGED', 'production_approved': False,
                'rig_ready': False, 'facial_ready': False, 'reference_version': manifest['version'],
                'reference_sha256': reference['sha256'], 'seed': seed, 'resolution': resolution,
                'source': 'microsoft/TRELLIS.2-4B', 'elapsed_seconds': round(time.monotonic()-started, 2),
                'storage_key': prefix+'.glb', **info}
        client.upload_file(str(path), os.environ['S3_BUCKET'], prefix+'.glb',
                           ExtraArgs={'ContentType': 'model/gltf-binary'})
        client.put_object(Bucket=os.environ['S3_BUCKET'], Key=prefix+'.json',
                          Body=json.dumps(meta).encode(), ContentType='application/json')
        return {'status': 'SUCCEEDED', 'mesh_created': True, 'metadata': meta}


def handler(event):
    try:
        return author(event)
    except Exception as error:
        # No credential values, provider response bodies or signed URLs in logs/output.
        print(f'Authoring failed: {type(error).__name__}', flush=True)
        return {'status': 'FAILED', 'error': 'AUTHORING_FAILED', 'mesh_created': False}


if __name__ == '__main__':
    import runpod
    runpod.serverless.start({'handler': handler})
