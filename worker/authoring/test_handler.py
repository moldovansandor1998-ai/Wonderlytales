import importlib.util
import json
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('authoring_handler', Path(__file__).with_name('handler.py'))
handler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handler)
manifest = json.loads((Path(__file__).parents[2] / 'production/references/V004/manifest.json').read_text())
ref = next(a for a in manifest['assets'] if a['id'] == 'CHAR_MARK_mesh_input')

class AuthoringContract(unittest.TestCase):
    def payload(self):
        return {'character': 'CHAR_MARK', 'reference_version': 'V004', 'reference_sha256': ref['sha256']}
    def test_fixed_reference_selected(self):
        char, reference, resolution, seed = handler.checked_reference(self.payload(), manifest)
        self.assertEqual(char, 'CHAR_MARK')
        self.assertEqual(reference['storage_key'], ref['storage_key'])
        self.assertEqual((resolution, seed), ('1536_cascade', 1978))
    def test_mismatched_identity_rejected(self):
        p = self.payload(); p['reference_sha256'] = '0'*64
        with self.assertRaises(ValueError): handler.checked_reference(p, manifest)
    def test_unavailable_character_cannot_be_fabricated(self):
        p = self.payload(); p['character'] = 'CHAR_LILI'
        with self.assertRaises(ValueError): handler.checked_reference(p, manifest)
    def test_lili_versioned_input_checksum(self):
        folder = Path(__file__).parents[2] / 'production/references/V005'
        v5 = json.loads((folder / 'manifest.json').read_text())
        reference = next(a for a in v5['assets'] if a['id'] == 'CHAR_LILI_mesh_input')
        import hashlib
        raw = (folder / reference['packaged_file']).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), reference['sha256'])
        self.assertEqual(len(raw), reference['bytes'])
        p = {'character': 'CHAR_LILI', 'reference_version': 'V005',
             'reference_sha256': reference['sha256']}
        self.assertEqual(handler.checked_reference(p, v5)[0], 'CHAR_LILI')
        p['reference_version'] = 'V004'
        with self.assertRaises(ValueError): handler.checked_reference(p, v5)
    def test_supporting_inputs_are_pinned_and_transparent(self):
        import hashlib
        from PIL import Image
        folder = Path(__file__).parents[2] / 'production/references'
        v6 = json.loads((folder/'V006/manifest.json').read_text())
        for character in ('CHAR_MORZSI', 'CHAR_POTTY', 'CHAR_BOGYO', 'CHAR_ZIZI'):
            reference = next(a for a in v6['assets'] if a['id'] == character+'_mesh_input')
            path = folder/'supporting/V001'/reference['packaged_file']
            raw = path.read_bytes()
            self.assertEqual(len(raw), reference['bytes'])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), reference['sha256'])
            with Image.open(path) as image:
                self.assertEqual(image.mode, 'RGBA')
                self.assertEqual(image.getchannel('A').getextrema()[0], 0)
            payload = {'character':character, 'reference_version':'V006', 'reference_sha256':reference['sha256']}
            self.assertEqual(handler.checked_reference(payload, v6)[0], character)
            payload['reference_sha256'] = '0'*64
            with self.assertRaises(ValueError): handler.checked_reference(payload, v6)

    def test_glb_requires_geometry(self):
        raw = json.dumps({'asset': {'version': '2.0'}}).encode()
        raw += b' ' * (-len(raw)%4)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/'empty.glb'
            path.write_bytes(struct.pack('<4sIII4s', b'glTF', 2, 20+len(raw), len(raw), b'JSON')+raw)
            with self.assertRaises(ValueError): handler.inspect_glb(path)
    def test_glb_truncation_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'bad.glb'; p.write_bytes(b'glTF')
            with self.assertRaises(ValueError): handler.inspect_glb(p)

if __name__ == '__main__': unittest.main()
