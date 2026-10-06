# Wonderly Tales Studio – MVP v2

Többnyelvű, professzionális 3D gyerek-animációs gyártóstúdió rendszer. Első sorozat: **Csodakapu / Wondergate** (4–9 év, 20–30 perces részek).

Alapelv: a CORE karakterek és visszatérő helyszínek **fix, verziózott 3D master assetek** (pl. `CHAR_MARK_V001`, `LOC_FOREST_V001`). Normál jelenet Blenderből készül; generatív videó csak opcionális VFX shotokra.

## Funkció-állapot jelölés

- **[WORKING NOW]** – teljesen implementálva, letesztelve
- **[MOCK/LOCAL]** – külső szolgáltatás nélküli helyi implementáció fejlesztéshez/teszthez
- **[PRODUCTION ADAPTER READY]** – a production kód teljes; csak API kulcs kell
- **[PRODUCTION ADAPTER READY]** – a production kód teljes; csak API kulcs kell
- **[REQUIRES EXTERNAL CREDENTIAL]** – a kód kész, de fizetős kulcs/futtatókörnyezet nélkül nem tesztelhető élesben
- **[FUTURE]** – tervezett, nincs implementálva

### Funkciótérkép

| Funkció | Állapot |
|---|---|
| Studio UI (dashboard + 12 modul, CRUD) | WORKING NOW |
| SHOT_SCHEMA_V1 + Zod runtime validáció | WORKING NOW |
| Asset versioning + lock (character/location/prop) | WORKING NOW |
| Continuity engine + diff UI | WORKING NOW |
| Render queue (státuszgép, retry, cost) | WORKING NOW |
| Shot Editor (karakter/prop/dialógus add-remove, verzió/costume választó, XYZ numerikus mezők, revision) | WORKING NOW |
| QC engine – determinisztikus checkek (ASSET_VERSION, CHARACTER, COSTUME, LOCATION, PROP_CONTINUITY, AUDIO, STATIC_SHOT) + RENDER_CORRUPTION ffprobe-alapú felbontás/fps/duration validációval | WORKING NOW |
| QC engine – vision/AI checkek (CLIPPING, EYE_DIRECTION, LIPSYNC…) | MOCK/LOCAL (provider adapter mögött) |
| Localization flow (HU master → fordítás → TTS → lip-sync track, 3D újrarender nélkül) | WORKING NOW |
| MockTranslationProvider | MOCK/LOCAL |
| ProductionTranslationProvider (OpenAI-kompatibilis LLM) | PRODUCTION ADAPTER READY |
| MockTts | MOCK/LOCAL |
| ElevenLabs TTS (HTTP, timeout, retry, rate-limit, cache hash, cost, binary audio) | PRODUCTION ADAPTER READY + REQUIRES EXTERNAL CREDENTIAL (mock HTTP-val tesztelve) |
| LocalVisemeFacial (audio/timing → viseme/blendshape JSON) | WORKING NOW |
| Audio2Face adapter | PRODUCTION ADAPTER READY (submit/poll skeleton) |
| LocalFilesystemStorageProvider (put/get/exists/delete/signedUrl/sha256 meta) | WORKING NOW |
| S3/Cloudflare R2 storage adapter | PRODUCTION ADAPTER READY |
| Supabase Auth (login, logout, SSR session, middleware, role) + route-döntés és RLS smoke tesztek | PRODUCTION ADAPTER READY (env megadásával aktív; mock módban ki van kapcsolva) |
| RLS policy-k (authenticated Studio user, service-role csak szerver) | WORKING NOW (migrációban) |
| Blender worker – proxy scene + valódi MP4/PNG render (Workbench preview / Eevee final) | WORKING NOW (Blender 4.5 LTS-szel tesztelve) |
| MockRenderWorker | MOCK/LOCAL |
| RemoteRenderWorker (RunPod serverless: submit/poll/cancel/timeout) | PRODUCTION ADAPTER READY + REQUIRES EXTERNAL CREDENTIAL (mock HTTP szerverrel tesztelve) |
| FFmpeg FinalAssemblyService – valódi shot-konkatenáció: input-ellenőrzés, per-clip normalizálás (1920×1080/24fps/yuv420p/48kHz), helyes sorrend, audio réteg-keverés, loudnorm, SRT+VTT, metadata JSON; production módban hiányzó shot = FAIL | WORKING NOW (integration teszt: 3 valódi clip concat + ffprobe validáció) |
| StoryEngine – MockStoryEngine | MOCK/LOCAL |
| StoryEngine – LlmStoryEngine (strukturált JSON, Zod validáció, repair/retry) | PRODUCTION ADAPTER READY (mock HTTP-val tesztelve) |
| Cost center (pricing config, category/provider/episode/per-minute/retry bontás) | WORKING NOW |
| demo:e2e – valódi preview MP4-k (Blender, ha elérhető, különben explicit FFmpeg test klipek), valódi concat assembly HU+EN, újrarender-mentes lokalizáció-bizonyíték, report.json | WORKING NOW |
| Generative video (VFX) – mock + remote (RunPod) adapter | PRODUCTION ADAPTER READY |
| Több sorozat ugyanazzal a Studio rendszerrel | FUTURE (az adatmodell támogatja) |

## Architektúra

```
src/
  app/                 Next.js 14 App Router – Studio UI (sötét production dashboard)
    login/ auth/callback/ logout/   Supabase Auth útvonalak
  lib/
    db/                Adatréteg: Supabase adapter VAGY lokális JSON mock (auto seed)
    schemas/shot.ts    SHOT_SCHEMA_V1 (Zod)
    pipeline.ts        Shot workflow (SAVE REVISION / PREVIEW / APPROVE / FINAL / LOCK)
    continuity.ts      Continuity Engine
    queue.ts           Render queue + worker dispatch
    worker.ts          MockRenderWorker + RemoteRenderWorker (RunPod)
    qc.ts              QC Engine
    assembly.ts        FFmpeg FinalAssemblyService
    cost.ts, pricing.ts  Cost aggregáció + pricing config
    localization.ts    Lokalizációs flow
    providers/         tts / facial / storage / genvideo / story / translation
    auth.ts            Supabase SSR auth helpers
  middleware.ts        Védett Studio route-ok
supabase/migrations/   PostgreSQL séma + RLS + profiles
worker/                Blender 4.5 LTS worker + Dockerfile + 3-shot fixture
scripts/               seed.ts, demo-e2e.ts
tests/                 Vitest (47 teszt)
```

## Requirements

Node.js 20+, npm. Opcionális: Docker, Blender 4.5 LTS (`BLENDER_PATH`), FFmpeg (`FFMPEG_PATH`), Supabase projekt.

## Install

```bash
npm ci
cp .env.example .env.local   # mock módhoz nem kell érték
```

## Supabase setup (local / remote)

- Local: `supabase start` → `supabase db reset` (futtatja a `supabase/migrations`-t)
- Remote: SQL Editor → `supabase/migrations/0001_init.sql`
- Auth: Supabase Dashboard → Authentication → Email engedélyezése; user létrehozása; `app_metadata.role` = `admin`/`studio` (vagy `profiles` tábla).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service-role CSAK szerveroldalon).
- Ha az env üres: **mock mód**, auth kikapcsolva, lokális JSON adatbázis auto-seeddel.

## Parancsok

```bash
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test             # 47 teszt
npm run build
npm run seed         # mock adatbázis újraseedelése
npm run demo:e2e     # teljes acceptance flow → artifacts/demo/
```

## demo:e2e output

```
artifacts/demo/
  hu/master.mp4        (1920×1080 H.264, ha FFmpeg elérhető)
  hu/audio_master.aac
  hu/subtitles.srt
  en/master.mp4        (lokalizált dialógusokkal)
  en/...
  report.json          (lépések + cost report)
```

Ha `BLENDER_PATH` be van állítva, a preview valódi Blender proxy renderrel is futhat; CI-ban mock render a default.

## Blender worker

```bash
# Blender nélkül (CI mock):
python3 worker/blender_worker.py --input worker/fixtures/shot_sh001.json --output out/ --mock
# Blender 4.5 LTS-szel (valódi MP4 preview proxy render):
blender --background --python worker/blender_worker.py -- --input worker/fixtures/shot_sh001.json --output out/
# Docker:
docker build -t wonderly-worker worker/
docker run --rm -v $PWD/out:/out wonderly-worker --input /worker/fixtures/shot_sh001.json --output /out
```

Fixture: `worker/fixtures/shot_sh001..003.json` – 3 kontinuus shot (WIDE→MEDIUM→CLOSE_UP, prop state DORMANT→GLOWING→ACTIVE). Output JSON: `status, output, frames, duration_sec, render_sec, renderer, error`.

## RunPod bekötés (production)

1. A `worker/` konténert pushold registrybe, hozz létre RunPod Serverless endpointot.
2. `.env`: `RENDER_WORKER=runpod`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`.
3. A render queue ezután a RemoteRenderWorkeren keresztül submitol/pollol/cancel; a job input_snapshotja immutable.

## ElevenLabs / R2

- ElevenLabs: `TTS_PROVIDER=elevenlabs` + `ELEVENLABS_API_KEY` → valódi HTTP adapter (timeout, retry, 429-kezelés, sha256 cache hash, cost event, audio binary → storage).
- R2: `STORAGE_PROVIDER=s3` + `S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY` → teljes put/get/exists/delete/signedUrl adapter (AWS SDK v3, `forcePathStyle`, region `auto`).

## Vercel deployment

`vercel` – env változók a dashboardon. A web app önállóan deployolható; a Blender worker külön infrastruktúra (RunPod/Docker).

## Auth/Security

- Production-ben a `src/middleware.ts` minden Studio route-ot véd; unauthorized → `/login` redirect.
- Login: jelszó vagy magic link; session: Supabase SSR cookie.
- Role: `app_metadata.role` (`admin`/`studio`/`viewer`); a Studio műveletek `admin`/`studio` szerepet várnak.
- RLS bekapcsolva; anon nem módosíthat; service-role sosem kerül browser bundle-be.

## Troubleshooting

- Üres adatbázis / reset: `npm run seed` (vagy töröld `data/demo.json`-t).
- `EADDRINUSE`: `npm run dev -- -p 3001`.
- Blender lassú CPU-n: a preview Workbench mód; finalhez GPU-s worker (RunPod) ajánlott.
- FFmpeg hiányzik: az assembly mock fallbacket használ, a flow attól végigmegy.
- Supabase auth hiba: ellenőrizd a redirect URL-eket (`/auth/callback`) a Supabase Dashboardon.
