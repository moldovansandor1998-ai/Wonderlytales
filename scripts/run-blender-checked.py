"""Run Blender only after a background Python initialization succeeds.

Set BLENDER_PATH to the complete installation's executable. Arguments after
-- are forwarded unchanged. A failed probe never starts a production job.
"""
import os
import shutil
import subprocess
import sys

binary = os.environ.get('BLENDER_PATH') or shutil.which('blender')
if not binary or not os.path.isfile(binary):
    raise SystemExit('A complete Blender installation is required; set BLENDER_PATH.')
probe = subprocess.run([binary, '--background', '--factory-startup', '-t', '2',
                        '--python-expr', 'import bpy; print("WONDERLY_BLENDER_READY", bpy.app.version_string)'],
                       capture_output=True, text=True, timeout=60)
if probe.returncode or 'WONDERLY_BLENDER_READY' not in probe.stdout:
    print(probe.stdout, file=sys.stderr)
    print(probe.stderr, file=sys.stderr)
    raise SystemExit(f'Blender initialization failed ({probe.returncode}); check installation integrity.')
args = sys.argv[1:]
if args and args[0] == '--':
    args = args[1:]
if not args:
    print(probe.stdout.strip())
else:
    raise SystemExit(subprocess.call([binary, *args]))
