# Wonderly Tales render worker – Blender 4.5 LTS alap
FROM nyyt/blender:4.5
WORKDIR /worker
COPY blender_worker.py /worker/
COPY fixtures /worker/fixtures
ENTRYPOINT ["blender", "--background", "--python", "/worker/blender_worker.py", "--"]
# Példa: docker run --rm -v $PWD/out:/out wonderly-worker --input /worker/fixtures/shot_demo.json --output /out
