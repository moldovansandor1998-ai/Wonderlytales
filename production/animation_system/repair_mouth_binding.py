"""Remove accidental limb/ear influence from a separate oral-patch candidate.

Only skin weights change. Existing shape keys, topology and original master
remain intact; this does not repair an unmatched seam or grant approval.
"""
import bpy, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from animation_system.refine_skin_continuity import stabilize_mouth
from animation_system.spec import digest, atomic_json

source, destination, codes = sys.argv[sys.argv.index('--') + 1:]
source, destination = Path(source), Path(destination)
if source.resolve() == destination.resolve():
    raise ValueError('A separate candidate path is required')
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
report = {'source_sha256': digest(source), 'blender': bpy.app.version_string,
          'production_approved': False, 'characters': {}}
for code in codes.split(','):
    patch = bpy.data.objects[code + '_FACIAL_TOPOLOGY']
    if patch.get('boundary_matched'):
        raise ValueError('Matched body boundary requires shared seam weights')
    report['characters'][code] = stabilize_mouth(patch)
bpy.context.scene['production_approved'] = False
bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()), compress=True)
report['candidate_sha256'] = digest(destination)
atomic_json(destination.with_suffix('.mouth-binding.json'), report)
