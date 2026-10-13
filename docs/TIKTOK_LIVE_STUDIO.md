# TikTok AI Live – 2026-10-13 folytatás

A meglévő WonderlyTales alkalmazás `/live-studio` része továbbfejlesztve, a filmgyártás és a korábbi médiaállományok változtatása nélkül.

## Elkészült

- Karakterenként kép, név, személyiség, ElevenLabs-hang; kompatibilis a korábbi böngészős mentéssel.
- Külön 9:16 adásképablak, ugyanazon böngészőből BroadcastChannel-kapcsolattal. A stúdiófül játssza a hangot, az adáskép nem duplázza. Hat másodpercig elmaradó állapot esetén jelzi a kapcsolatvesztést.
- Komment, követés és ajándék eseménysor, maximum 50 várakozóval, 2000 eseményazonosítót tároló ismétlésszűréssel. Válaszadás kizárólag külön indítás után, egyszerre egy hanggal. Leállítás és hibánál szünet. Beállítható munkamenetenkénti válaszkorlát.
- Magyar ElevenLabs Flash 2.5 hang és ugyanabból a generálásból karakteridőzítés. Egy kéréshez egy szolgáltatói kísérlet; nincs rejtett ismételt terhelés. A hang a meglévő `tts` költségkeretet foglalja, és az API a stúdiójogosultságot/Origin fejlécet ellenőrzi.
- Rövid magyar AI-válasz végpont, a meglévő Story-szolgáltató konfigurációját használva. Kommentek adatként kerülnek az AI-hoz, az AI nem hajt végre külső műveletet. Az AI a meglévő `story` költségkeret ellenőrzése után hívható.
- Egyértelműen megjelölt, előre megírt tesztválaszok. Ezek nem AI-generálás eredményei.
- Saját zenék betöltése, `!zene pontos cím` kéréslista, engedélyezett automatikus lejátszás csak egyértelmű cím-egyezéskor. Beszéd közben 80%-os halkítás. Nincs internetes zenekeresés vagy letöltés.
- Helyi, loopback címre kötött TikTok-kommentösszekötő (`tools/tiktok-bridge`), eredetellenőrzéssel, párosítási kóddal, ajándéksorozatok lezárásának kezelésével. Nem küld kommenteket és nem indít adást.

## Ellenőrzött állapot és hiányzó feltételek

- A Vercel production környezetben az `ELEVENLABS_API_KEY` szerepel. A tényleges fizetős hangkészítést és az adott Voice ID hozzáférését ebben a folytatásban nem teszteltük.
- A production környezetben **nincs `STORY_API_KEY`**; ezért az AI-válaszmód le van tiltva a felületen. Új API-kapcsolat és a `story` szolgáltatási költségkeret ellenőrzése szükséges. Új kulcsot nem hoztunk létre és titkot nem másoltunk.
- A karakter **állókép**. A hang karakteridőzítése rendelkezésre állhat, de nem állítunk elő professzionális száj- vagy testanimációt. A továbblépés valós időben animálható, a referenciával egyező karakter és megfelelő animációs futtató bekötése. A régi helyi, szövegalapú ál-viseme generátor nem kerül használatba a live-ban.
- Aktív TikTok-fiók és a felhasználó közvetítő számítógépe nélkül valódi LIVE-kommentekkel nem történt végponttól végpontig teszt. Az összekötő nem hivatalos kliens; működése szolgáltatói korlátoktól függhet.
- A karakterbeállítások böngészőhöz kötöttek; a zenefájlok csak az adott munkamenetben élnek.
- A teljes adás indítása és rögzítése a felhasználó TikTok LIVE Studio hozzáférését igényli.

## Validáció

- 12 Vitest: sorban állás/duplikáció/torlódás, zenekérés felismerése, promptszétválasztás, hangköltség-foglalás és ismételt terhelés elkerülése, hangidőzítési válasz, jogosultság/Origin/bemeneti korlátok és hiányzó AI-kulcs.
- 3 Node-teszt: TikTok eseményszerkezet és ajándéksorozat kezelés.
- Helyi WebSocket-integrációs próba: ismeretlen Origin és hibás párosítási kód elutasítva, TikTok-hívás nélkül.
- TypeScript és Next.js production build. A meglévő workflow-buildek utóellenőrzése is sikeres.
- Böngészős látvány- és teljes hangteszt nem történt.

Dokumentáció a bekötéshez: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps és https://github.com/zerodytrash/TikTok-Live-Connector .

## Runway-folytatás – külön élő próba, még nem teljes TikTok-animáció

A `codex/runway-live-avatar` ág külön, legfeljebb 60 másodperces, mikrofonos Runway–ElevenLabs élő próbát ad a stúdióhoz. Ez tényleges WebRTC-képet fogad az `@runwayml/avatars` 0.17.0 SDK-val; nem állít elő helyi ál-animációt. A TikTok-eseménysor és a külön adásablak egyelőre továbbra is az állóképes útvonalat használja.

Szerverkonfiguráció (titkot ne írj ebbe a dokumentumba vagy klienskódba):

- `RUNWAYML_API_SECRET`: a megfelelő Runway Dev projekt kulcsa, kizárólag szerveren.
- `RUNWAY_AVATAR_ID`: sikeresen feldolgozott, a kulccsal elérhető karakter UUID.
- `ELEVENLABS_API_KEY`: meglévő szerverkulcs; az ElevenAgents olvasási hozzáférést is ellenőrizni kell.
- `ELEVENLABS_AGENT_ID`: magyar nyelvű ElevenLabs Agent, `conversation_config.asr.user_input_audio_format=pcm_16000`, `conversation_config.tts.voice_id=f9YzCDZYS8Zjl6RbHErx`, `conversation_config.agent.language=hu`, `conversation_config.conversation.max_duration_seconds=60`.
- A meglévő gyártási költségkeretben külön, szolgáltatói számlázással ellenőrzött `runway_live_60s` és `elevenlabs_agent_60s` munkánkénti plafon szükséges. Ezeket a fejlesztés nem kapcsolja be és nem talál ki árat.

A fizetős létrehozás előtt a szerver ellenőrzi a Runway-karakter állapotát, az ElevenLabs Agent hangját, nyelvét és időkorlátját. Mindkét keretet lefoglalja. A Runway `maxDuration:60` szolgáltatói korlátot is kap; a böngészős időzítő csak másodlagos védelem. Nincs automatikus újraindítás vagy fizetős újrapróbálás. Az azonos kérésazonosítót az R2 feltételes írása deduplikálja. A rekord a felhasználóhoz kötött, és nem tartalmaz API-kulcsot, ElevenLabs signed URL-t vagy WebRTC-tokent. A leállítás a létrehozással való versenyhelyzetet is kezeli. Ha a létrehozás úgy szakad meg, hogy nincs visszakapott munkamenet-ID, az állapot bizonytalan: nincs ismétlés, a szolgáltatói időkorlát marad a végső korlát.

2026-10-13 szolgáltatói ellenőrzés:

- A felhasználó belépett a Runway Dev felületre és a kezdőbeállítás elkészült.
- Feltöltöttük a meglévő kalózképet. A karakter rekordja: `baa672bd-4424-4732-ad14-55eb52bc81f7`.
- A Runway „This text cannot be used for an avatar. Please update the personality or start script.” hibát jelez; a karakter nem READY, a Start chat gomb letiltott. A rövidebb kezdőszöveg mentése sikerült, a két egyszerűsített személyiségleírást is 400-as hibával utasította el a szolgáltató (Request History felületen ellenőrizve). Az eredeti karakterrekordot megőriztük; nem töröltük és nem indítottunk újabb generálásokat.
- A megnyitott fejlesztői projekt egyenlege 0 kredit. A fogyasztói Runway-connector másik, „Moldovan” nevű munkaterületet mutatott Free csomaggal; ebből nem következtetünk a felhasználó megvásárolt előfizetésének állapotára.
- API-kulcs létrehozására vagy titok átmásolására nem került sor. Vercelben a Runway-kulcs, az Avatar ID és az ElevenLabs Agent ID még nincs beállítva.
- A publikus SDK itt ellenőrzött felülete mikrofon-/kamerabemenetet ad; TikTok szöveges eseményekhez nincs benne dokumentált `sendText` metódus. A teljes automatikus kommentanimációhoz a dokumentált LiveKit Agents útvonal vagy szolgáltató által igazolt szöveges vezérlés szükséges. Nem küldünk kitalált adatcsatorna-üzeneteket.

Validáció: 24 célzott Vitest sikeres, TypeScript és production build sikeres. A meglévő 3 workflow / 9 feldolgozási lépés buildellenőrzése sikeres. Éles Runway/ElevenLabs-munkamenet és böngészős média-/mikrofonteszt a fenti hozzáférések nélkül nem történt. A Runway-kiegészítés külön fejlesztési ág, nem állítjuk be automatikusan éles adásként.

Hivatalos integrációs források:
- https://docs.dev.runwayml.com/characters/elevenlabs/
- https://docs.dev.runwayml.com/characters/integration/
- https://docs.dev.runwayml.com/characters/livekit/
- https://elevenlabs.io/docs/api-reference/agents/get
