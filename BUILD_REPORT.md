# BUILD REPORT – wonderly-tales-studio-mvp-v3

Dátum: 2026-10-07 (UTC)
Környezet: Linux x86_64 (Debian 12 alapú sandbox, kernel 6.6.69)
Node: v20.20.2
npm: 11.19.0
Python: 3.12.12
FFmpeg: 5.1.9 (libx264, lavfi, loudnorm)
Blender: 4.5.3 LTS (headless, Workbench renderelő)

## Parancsok és exit code-ok (fejlesztői környezet)

| Parancs | Exit code | Eredmény |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | lockfile-ból, eltérés nélkül |
| `npm run lint` | 0 | No ESLint warnings or errors |
| `npm run typecheck` (`tsc --noEmit`) | 0 | hiba nélkül |
| `npm test` (`vitest run`) | 0 | 13 test file, **61 teszt passed, 0 failed** (59 s) |
| `npm run build` (`next build`) | 0 | 21 route + middleware, production build OK |
| `npm run demo:e2e` (Blender preview-vel) | 0 | artifacts/demo teljes kimenet (lásd lent) |

## Blender worker teszt

- Blender 4.5.3 LTS letöltve, `worker/blender_worker.py` headless futtatva.
- 3 fixture (shot_sh001..003.json) **valódi render**: mindhárom `SUCCEEDED`, exit 0, renderer=`blender` (27,1 s / 17,6 s / 14,4 s).
- A preview-k színes proxy karaktereket, kameramozgást, prop-ot és kontinuitást (WIDE → MEDIUM → CLOSE_UP, DORMANT → GLOWING → ACTIVE) tartalmaznak; frame-szinten ellenőrizve.
- Mock mód (`--mock`) szintén ellenőrizve: exit 0, renderer=`mock`.
- Érvénytelen fixture validáció: exit code 2 (elvárt hibaútvonal).

## FFmpeg integration teszt

- `tests/s3Assembly.test.ts` – **valódi concat**: 3 különböző hosszú teszt-clip (2 s / 3 s / 2,5 s, eltérő felbontás/fps) → normalize (1920×1080, 24 fps, yuv420p, AAC 48 kHz stereo) → concat demuxer.
- ffprobe validáció a masteren: 1920×1080, 24/1 fps, h264 + aac, duration ≈ 7,5 s (±1,0 s) – mindhárom clip benne van.
- Hiányzó final shot esetén a production assembly **FAIL** (`AssemblyError: Hiányzó final shot…`), placeholder csak explicit `mock: true` módban.
- demo:e2e master: 1920×1080, h264+aac, 24 fps, 13,035 s (ffprobe ellenőrizve).

## demo:e2e artifacts (BLENDER_PATH beállítva)

- `artifacts/demo/previews/SH001..003.mp4` – Blender-renderelt proxy preview-k (vizuálisan különböző, folytonos).
- `artifacts/demo/hu/master.mp4` + `subtitles.srt` / `.vtt` + `audio_master.aac` + `metadata.json`
- `artifacts/demo/en/master.mp4` + `subtitles.srt` / `.vtt` + `metadata.json` (lokalizált dialógusok)
- `noReRenderForLocalization: true` – a lokalizáció **nem renderelt újra** (render job szám változatlan, EN assembly ugyanazokat a clip path-eket használja).
- `report.json` – lépésnapló, artifact lista, blender útvonal, cost report (TRANSLATION kategória, nyelv mezővel).

## Docker build eredmény

- A sandboxban **nincs docker démon** (`docker: not found`), ezért a `worker/Dockerfile` build nem futtatható itt.
- A Dockerfile (`nyyt/blender:4.5` alap, blender_worker.py + fixtures + requirements) statikusan ellenőrizve; a worker script maga natívan, Blender 4.5.3-mal bizonyított (fent).

## Auth/RLS

- `tests/authRls.test.ts`: middleware route-döntési mátrix, service-role kulcs kliens-bundle tiltás (fájl-scan), RLS policy smoke (`studio_user_all`, minden táblán enabled).

## Tiszta-környezet (clean-room) validáció

A végleges `wonderly-tales-studio-mvp-v3.zip` kicsomagolva **teljesen üres könyvtárba**, onnan:

| Parancs | Exit code |
|---|---|
| `npm ci` | 0 |
| `npm run lint` | 0 |
| `npm run typecheck` | 0 |
| `npm test` | 0 (61 passed) |
| `npm run build` | 0 |
| `npm run demo:e2e` | 0 |

A ZIP tiszta: nincs benne `node_modules`, `.next`, `data/*.json`, `artifacts/`, `*.tsbuildinfo`, `.env`, beágyazott `.zip`.
