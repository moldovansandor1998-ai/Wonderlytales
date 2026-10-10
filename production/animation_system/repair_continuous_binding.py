"""Apply V024 continuous envelopes to a separate V022/V023 diagnostic copy."""
import bpy
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from animation_system.continuous_binding import rebind_body
from animation_system.spec import digest, atomic_json, FACE_PROFILES, QUADRUPEDS


def main(source, registry, destination, profile='attachment'):
    if source.resolve() == destination.resolve():
        raise ValueError('Never overwrite the source')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()), use_scripts=False)
    reg = json.loads(registry.read_text())
    report = {'source_sha256': digest(source), 'blender': bpy.app.version_string,
              'binding_code_sha256': digest(Path(__file__).with_name('continuous_binding.py')),
              'profile': profile,
              'production_approved': False, 'characters': {}}
    for code in ('CHAR_LILI', 'CHAR_POTTY', 'CHAR_ZIZI'):
        asset = reg['characters'][code]
        rig, body = bpy.data.objects[asset['rig']], bpy.data.objects[asset['body']]
        report['characters'][code] = rebind_body(body, rig, code,
            FACE_PROFILES[code]['head_floor'], code in QUADRUPEDS, profile)
        print('BINDING_READY', code, flush=True)
    bpy.context.scene['production_approved'] = False
    bpy.context.scene['status'] = 'V024_BINDING_CANDIDATE'
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(destination.resolve()), compress=True)
    report['candidate_sha256'] = digest(destination)
    atomic_json(destination.with_suffix('.binding.json'), report)


if __name__ == '__main__':
    args=sys.argv[sys.argv.index('--')+1:]
    main(*map(Path,args[:3]), profile=args[3] if len(args)>3 else 'attachment')
