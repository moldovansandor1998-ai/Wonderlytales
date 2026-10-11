"""Read-only host preflight. Does NOT launch license-metered applications."""
import argparse
import json
import os
import platform
import shutil
from pathlib import Path

def inspect_host(maya=None, unreal=None):
    def executable(explicit, name):
        candidate = str(explicit) if explicit else shutil.which(name)
        return str(Path(candidate).resolve()) if candidate and Path(candidate).is_file() and os.access(candidate, os.X_OK) else None
    maya_path = executable(maya, 'mayapy')
    unreal_path = executable(unreal, 'UnrealEditor-Cmd')
    return {
        'kind': 'HOST_PREFLIGHT_ONLY', 'system': platform.system(),
        'maya_executable': maya_path, 'unreal_executable': unreal_path,
        'maya_runtime_tested': False, 'unreal_runtime_tested': False,
        'license_verified': False, 'production_approved': False,
        'status': 'EXECUTABLES_FOUND_LICENSE_AND_RUNTIME_UNVERIFIED' if maya_path and unreal_path else 'BLOCKED_MISSING_DCC',
        'blockers': [x for x, present in [('MAYA_NOT_AVAILABLE', maya_path), ('UNREAL_NOT_AVAILABLE', unreal_path)] if not present],
        'paid_process_started': False,
    }

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--maya', type=Path)
    p.add_argument('--unreal', type=Path)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    result = inspect_host(args.maya, args.unreal)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result, indent=2))
    raise SystemExit(2 if result['blockers'] else 0)
