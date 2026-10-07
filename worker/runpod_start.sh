#!/bin/sh
set -eu
echo "Wonderly preview worker: starting Xvfb and Python handler"
# Workbench needs a display even when Blender runs in background mode.
exec xvfb-run -a -s "-screen 0 1280x720x24" python3 -u /worker/runpod_handler.py
