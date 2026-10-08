"""Use already isolated RGBA assets; no background-removal model is needed."""
from pathlib import Path
import os

root = Path(os.environ.get('WONDERLY_TRELLIS_ROOT', '/opt/trellis2'))
path = root / 'trellis2/pipelines/trellis2_image_to_3d.py'
source = path.read_text()
old = "pipeline.rembg_model = getattr(rembg, args['rembg_model']['name'])(**args['rembg_model']['args'])"
if source.count(old) != 1:
    raise RuntimeError('Pinned upstream background loader changed')
path.write_text(source.replace(old, 'pipeline.rembg_model = None'))

# PyTorch's CUDA 12.8 SDPA kernels support Blackwell. Preserve the pinned
# variable-length attention semantics without an Ampere-only extension.
config = root / 'trellis2/modules/sparse/config.py'
source = config.read_text()
old = "['xformers', 'flash_attn', 'flash_attn_3']"
if source.count(old) != 1:
    raise RuntimeError('Pinned sparse backend selector changed')
config.write_text(source.replace(old, "['xformers', 'flash_attn', 'flash_attn_3', 'sdpa']"))
attention = root / 'trellis2/modules/sparse/attention/full_attn.py'
source = attention.read_text()
anchor = "    elif config.ATTN == 'flash_attn':"
if source.count(anchor) != 1:
    raise RuntimeError('Pinned sparse attention dispatch changed')
sdpa = '''    elif config.ATTN == 'sdpa':
        if num_all_args == 1:
            q, k, v = qkv.unbind(dim=1)
        elif num_all_args == 2:
            k, v = kv.unbind(dim=1)
        out = _sdpa_varlen(q, k, v, q_seqlen, kv_seqlen)
'''
helper = '''

def _sdpa_varlen(q, k, v, q_lengths, k_lengths):
    from torch.nn.functional import scaled_dot_product_attention
    return torch.cat([
        scaled_dot_product_attention(
            qi.transpose(0, 1).unsqueeze(0),
            ki.transpose(0, 1).unsqueeze(0),
            vi.transpose(0, 1).unsqueeze(0)
        ).squeeze(0).transpose(0, 1)
        for qi, ki, vi in zip(q.split(q_lengths), k.split(k_lengths), v.split(k_lengths))
    ], dim=0)
'''
attention.write_text(source.replace(anchor, sdpa + anchor) + helper)
window = root / 'trellis2/modules/sparse/attention/windowed_attn.py'
source = window.read_text()
source = source.replace('from .. import config', 'from .. import config\nfrom .full_attn import _sdpa_varlen', 1)
source = source.replace("    if config.ATTN == 'xformers':", "    attn_func_args = {}\n    if config.ATTN == 'xformers':", 1)
self_anchor = '    out = out[bwd_indices]      # [T, H, C]'
cross_anchor = '    out = out[q_bwd_indices]      # [T, H, C]'
if source.count(self_anchor) != 1 or source.count(cross_anchor) != 1:
    raise RuntimeError('Pinned windowed attention dispatch changed')
source = source.replace(self_anchor, '''    elif config.ATTN == 'sdpa':
        q, k, v = qkv_feats.unbind(dim=1)
        lengths = seq_lens.tolist()
        out = _sdpa_varlen(q, k, v, lengths, lengths)

''' + self_anchor)
source = source.replace(cross_anchor, '''    elif config.ATTN == 'sdpa':
        k, v = kv_feats.unbind(dim=1)
        out = _sdpa_varlen(q_feats, k, v, q_seq_lens.tolist(), kv_seq_lens.tolist())

''' + cross_anchor)
window.write_text(source)
