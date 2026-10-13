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
