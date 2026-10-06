# Render worker

- `blender_worker.py` – Shot JSON → validálás → scene build → render → result JSON
- Blender nélkül is fut: `python3 blender_worker.py --input fixtures/shot_demo.json --output out/ --mock`
- Blenderrel: `blender --background --python blender_worker.py -- --input fixtures/shot_demo.json --output out/`
- Docker: `docker build -t wonderly-worker worker/ && docker run --rm -v $PWD/out:/out wonderly-worker --input /worker/fixtures/shot_demo.json --output /out`
- Későbbi RunPod hookup: ugyanez a container, a job input_snapshotja az input JSON.
