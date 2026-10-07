"""Use already isolated RGBA assets; no background-removal model is needed."""
from pathlib import Path

path = Path('/opt/trellis2/trellis2/pipelines/trellis2_image_to_3d.py')
source = path.read_text()
old = "pipeline.rembg_model = getattr(rembg, args['rembg_model']['name'])(**args['rembg_model']['args'])"
if source.count(old) != 1:
    raise RuntimeError('Pinned upstream background loader changed')
path.write_text(source.replace(old, 'pipeline.rembg_model = None'))
