# Render worker

- `blender_worker.py` – Shot JSON → validálás → scene build → render → result JSON
- Blender nélkül is fut: `python3 blender_worker.py --input fixtures/shot_demo.json --output out/ --mock`
- Blenderrel: `blender --background --python blender_worker.py -- --input fixtures/shot_demo.json --output out/`
- Docker: `docker build -t wonderly-worker worker/ && docker run --rm -v $PWD/out:/out wonderly-worker --input /worker/fixtures/shot_demo.json --output /out`
- Későbbi RunPod hookup: ugyanez a container, a job input_snapshotja az input JSON.

## RunPod proxy preview

`Dockerfile.runpod` runs the Serverless handler and uploads a real Blender MP4
into R2. Build with `docker build -f worker/Dockerfile.runpod -t YOUR_IMAGE worker/`.
The endpoint needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
Input: `{ "shot": SHOT_SCHEMA_V1, "type": "PREVIEW" }`.
FINAL intentionally fails until locked master assets replace the proxy primitives.
The Docker image and live endpoint still require a real deployment smoke test.

Production storage verification: `node --import tsx scripts/storage-smoke.ts`.
Credentials must be supplied by the environment; the test never prints them.
