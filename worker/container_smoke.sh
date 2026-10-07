#!/bin/sh
set -eu
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
xvfb-run -a -s "-screen 0 1280x720x24" blender --background --python /worker/blender_worker.py -- \
    --input /worker/fixtures/shot_demo.json --output "$test_dir"
video="$test_dir/11111111-1111-4111-8111-111111111111_r1.mp4"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,nb_frames \
    -show_entries format=duration -of json "$video"
ffmpeg -v error -i "$video" -f null -
