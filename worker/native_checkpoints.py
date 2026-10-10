"""Immutable object-store checkpoints, usable across ephemeral GPU containers."""
import hashlib
import json
from pathlib import Path

def render_identity(job):
    keys = ('operation','scene_key','scene_sha256','frame_start','frame_end','width','height','samples','renderer_revision')
    return hashlib.sha256(json.dumps({k:job[k] for k in keys if k in job},sort_keys=True).encode()).hexdigest()

def valid_png(data):
    return data.startswith(b'\x89PNG\r\n\x1a\n') and data.endswith(b'IEND\xaeB`\x82')

def save_frame(client,bucket,prefix,path):
    data=Path(path).read_bytes()
    if not valid_png(data): raise RuntimeError('Incomplete native PNG')
    sha=hashlib.sha256(data).hexdigest()
    client.put_object(Bucket=bucket,Key=f'{prefix}/{Path(path).name}',Body=data,
                      ContentType='image/png',Metadata={'sha256':sha})
    return sha

def restore_frames(client,bucket,prefix,root,start,end):
    root=Path(root);root.mkdir(parents=True,exist_ok=True);restored=[]
    for frame in range(start,end+1):
        name=f'frame_{frame:06d}.png'
        try: obj=client.get_object(Bucket=bucket,Key=f'{prefix}/{name}')
        except Exception as error:
            if getattr(error,'response',{}).get('Error',{}).get('Code') in ('NoSuchKey','404','NotFound'): continue
            raise
        data=obj['Body'].read()
        if valid_png(data) and hashlib.sha256(data).hexdigest()==obj.get('Metadata',{}).get('sha256'):
            (root/name).write_bytes(data);restored.append(frame)
    return restored
