# BUILD REPORT V4 – wonderly-tales-studio-mvp-v4

Dátum: 2026-10-07 (UTC)
OS: Linux x86_64 (Debian 12 alapú sandbox, kernel 6.6.69)
Node version: v20.20.2
npm version: 11.19.0
Python: 3.12.12 | FFmpeg: 5.1.9 | Blender: 4.5.3 LTS (headless)

## Tisztított átadás

- A v4 ZIP-ben **egyetlen projekt** van, a ZIP gyökerében közvetlenül (`package.json` a gyökérben).
- Nincs nested ZIP, nincs régi v1/v2/v3 csomag, nincs node_modules / .next / cache / tsbuildinfo / secret.
- `.env.example` és `.gitignore` a projekt gyökerében, és a `.env.example` NINCS ignorálva.

## Acceptance futtatás a frissen kibontott v4 ZIP-ből (teljesen üres TEMP könyvtár)

| Parancs | Exit code | Eredmény |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | lockfile-ból, eltérés nélkül |
| `npm run lint` | 0 | No ESLint warnings or errors |
| `npm run typecheck` | 0 | hiba nélkül |
| `npm test` (vitest run) | 0 | **13 test file, 61 teszt passed, 0 failed** |
| `npm run build` | 0 | 21 route + middleware, production build OK |
| `npm run demo:e2e` | 0 | teljes pipeline, artifacts/demo kimenet |

## FFmpeg integration eredmény

- `tests/s3Assembly.test.ts`: 3 valódi teszt-clip (2s/3s/2,5s, eltérő felbontás/fps) → normalize → concat; ffprobe validáció: 1920×1080, 24/1 fps, h264+aac, duration ≈ 7,5 s – mindhárom clip a masterben.
- Hiányzó final shot → production assembly FAIL (`AssemblyError`), placeholder csak explicit mock módban.
- demo:e2e master: 1920×1080, h264+aac, 24 fps (ffprobe ellenőrizve).

## Blender worker / demo eredmény

- `worker/blender_worker.py` Blender 4.5.3-mal: 3 fixture (shot_sh001..003) valódi render, mind `SUCCEEDED`, renderer=blender; mock mód és érvénytelen fixture (exit 2) szintén ellenőrizve.
- demo:e2e `BLENDER_PATH`-dal: SH001–003 preview-k Blenderből, `noReRenderForLocalization: true` (a lokalizáció nem renderel újra).
- Docker: sandboxban nincs docker démon; a `worker/Dockerfile` statikusan ellenőrzött, a worker natívan bizonyított.
