"""Check patched upstream attention against explicit block-local softmax.

Runs on CPU during image build; the endpoint checks CUDA separately.
"""
import importlib.util
from pathlib import Path
import sys
import types
import torch

root = Path(sys.argv[1])


class TensorBlocks:
    def __init__(self, feats, lengths, coords=None):
        self.feats, self.lengths, self.coords = feats, lengths, coords
        offset = 0
        self.layout = []
        for n in lengths:
            self.layout.append(slice(offset, offset + n)); offset += n
        self.shape = (len(lengths),) + tuple(feats.shape[1:])
        self.device = feats.device
        self.spatial_shape = coords[:, 1:].max(0).values.tolist() if coords is not None else None
        self.cache = {}

    def replace(self, feats):
        return TensorBlocks(feats, self.lengths, self.coords)

    def get_spatial_cache(self, key):
        return self.cache.get(key)

    def register_spatial_cache(self, key, value):
        self.cache[key] = value


package = types.ModuleType('probe_sparse'); package.__path__ = []
package.VarLenTensor = package.SparseTensor = TensorBlocks
package.config = types.SimpleNamespace(ATTN='sdpa', DEBUG=False)
sys.modules['probe_sparse'] = package
sub = types.ModuleType('probe_sparse.attention'); sub.__path__ = []
sys.modules[sub.__name__] = sub


def load(name):
    path = root / ('trellis2/modules/sparse/attention/' + name + '.py')
    spec = importlib.util.spec_from_file_location('probe_sparse.attention.' + name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module; spec.loader.exec_module(module)
    return module


def reference(q, k, v):
    weights = torch.einsum('thc,shc->hts', q, k) / q.shape[-1] ** .5
    return torch.einsum('hts,shc->thc', weights.softmax(-1), v)


torch.manual_seed(19)
full, window = load('full_attn'), load('windowed_attn')
qkv = torch.randn(7, 3, 2, 4)
blocks = TensorBlocks(qkv, [2, 5])
expected = torch.cat([reference(*p.unbind(1)) for p in qkv.split([2, 5])])
torch.testing.assert_close(full.sparse_scaled_dot_product_attention(blocks).feats, expected)

q, k, v = torch.randn(7, 2, 4), torch.randn(8, 2, 4), torch.randn(8, 2, 3)
expected = torch.cat([reference(a, b, c) for a, b, c in
                      zip(q.split([2, 5]), k.split([3, 5]), v.split([3, 5]))])
result = full.sparse_scaled_dot_product_attention(TensorBlocks(q, [2, 5]),
    TensorBlocks(k, [3, 5]), TensorBlocks(v, [3, 5]))
torch.testing.assert_close(result.feats, expected)

# Interleaved coordinates test partitioning, batch isolation and undoing sort.
coords = torch.tensor([[0, 0, 0, 0], [0, 4, 0, 0], [1, 0, 0, 0],
                       [0, 1, 0, 0], [1, 1, 0, 0], [0, 5, 0, 0]])
qkv = torch.randn(6, 3, 2, 4)
blocks = TensorBlocks(qkv, [4, 2], coords)
expected = torch.empty(6, 2, 4)
for indices in [[0, 3], [1, 5], [2, 4]]:
    expected[indices] = reference(*qkv[indices].unbind(1))
torch.testing.assert_close(window.sparse_windowed_scaled_dot_product_self_attention(
    blocks, 4).feats, expected)
q, kv = torch.randn(6, 2, 4), torch.randn(6, 2, 2, 4)
expected = torch.empty(6, 2, 4)
for indices in [[0, 3], [1, 5], [2, 4]]:
    k, v = kv[indices].unbind(1)
    expected[indices] = reference(q[indices], k, v)
torch.testing.assert_close(window.sparse_windowed_scaled_dot_product_cross_attention(
    TensorBlocks(q, [4, 2], coords), TensorBlocks(kv, [4, 2], coords), 4, 4).feats, expected)
print('BLACKWELL_SDPA_REFERENCE_CHECKS_PASSED: full self, variable cross, window self/cross')
