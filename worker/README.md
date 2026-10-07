# Render worker

- `blender_worker.py` – Shot JSON → validálás → scene build → render → result JSON
- Blender nélkül is fut: `python3 blender_worker.py --input fixtures/shot_demo.json --output out/ --mock`
- Blenderrel: `blender --background --python blender_worker.py -- --input fixtures/shot_demo.json --output out/`
- Docker: `docker build -t wonderly-worker worker/ && docker run --rm -v $PWD/out:/out wonderly-worker --input /worker/fixtures/shot_demo.json --output /out`
- Későbbi RunPod hookup: ugyanez a container, a job input_snapshotja az input JSON.

## RunPod proxy preview

`Dockerfile.runpod` runs the Serverless handler and uploads a real Blender MP4
into R2. Build from the repository root with
`docker build -f worker/Dockerfile.runpod -t YOUR_IMAGE .`.
The endpoint needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
Input: `{ "shot": SHOT_SCHEMA_V1, "type": "PREVIEW" }`.
FINAL intentionally fails until locked master assets replace the proxy primitives.
The Docker image and live endpoint still require a real deployment smoke test.
Run the container render check with
`docker run --rm --entrypoint sh YOUR_IMAGE /worker/container_smoke.sh`.
It renders the four-second fixture, probes the H.264 output, and decodes every frame.

For RunPod's GitHub deployment, choose this repository, branch `main`, and
Dockerfile path `worker/Dockerfile.runpod`. Use a Queue endpoint with zero
active workers and one maximum worker. Set an execution timeout of 900000 ms
and an idle timeout of 5 seconds. Add the four R2 variables above as runtime
environment variables, never build args. Keep `RUNPOD_ENDPOINT_ID` unset in the
Studio until this endpoint passes a live PREVIEW job and the uploaded video is
verified in R2. Other account endpoints are incompatible with this handler.

Production storage verification: `node --import tsx scripts/storage-smoke.ts`.
Credentials must be supplied by the environment; the test never prints them.

## Storybook character preview

Choose “Mesés erdő – Márk és Lili karakterpróba” in the shot editor, or send
`render.visual_style = "STORYBOOK_DRAFT_V003"`. The image bakes two versioned
`.blend` draft assets at build time, then appends those same assets for each
shot. It supports Márk and Lili, a fixed forest set, articulated walking and
waving, blinking, tail motion and a camera dolly. These draft assets do not
replace or approve the locked production asset records. FINAL remains blocked.

The preview supports EEVEE or Cycles (two CPU threads, 8 samples with denoising), at a
maximum of 768×432. It has no synthesized dialogue or lip sync. Camera lens,
framing and static/dolly moves are supported; other camera motions need further
implementation. Use `fixtures/shot_storybook.json` for a reproducible trial.
