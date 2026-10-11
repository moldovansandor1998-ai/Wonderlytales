"""Probe the unmodified, pinned official addon in a disposable Blender session."""
import bpy
import importlib.util
import json
import sys
import traceback
from pathlib import Path

args = sys.argv[sys.argv.index('--') + 1:]
addon, output = map(Path, args)
result = {'blender': bpy.app.version_string, 'registered': False, 'retarget_operator': False,
          'cloud_capture_tested': False, 'production_approved': False}
try:
    spec = importlib.util.spec_from_file_location('rokoko_studio_live_blender', addon / '__init__.py',
                                                 submodule_search_locations=[str(addon)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    module.register()
    result['registered'] = True
    result['version'] = list(module.bl_info['version'])
    result['retarget_operator'] = bpy.ops.rsl.retarget_animation.get_rna_type().identifier
    # Do not patch login, activate subscriptions, start streams or invoke a paid API.
    module.unregister()
except Exception:
    result['error'] = traceback.format_exc()
output.write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
