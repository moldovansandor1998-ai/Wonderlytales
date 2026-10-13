# WonderlyTales TikTok-kommentösszekötő

Ez az összekötő a nyilvános TikTok LIVE kommentjeit, ajándékait és követéseit továbbítja a WonderlyTales stúdiónak. **Nem indít adást, és nem küld kommentet a TikTokra.** Az adást a TikTok LIVE Studio alkalmazásból kell elindítani.

1. Telepíts Node.js 22 vagy újabb verziót az adást futtató számítógépre.
2. Töltsd le ezt a mappát a repóból, és nyiss benne terminált.
3. `npm ci`
4. `npm start`
5. Másold a terminálban megjelenő párosítási kódot a https://wonderlytales.vercel.app/live-studio oldal TikTok-kommentkapcsolat részébe.
6. Add meg az éppen élő TikTok-fiók felhasználónevét, és kapcsolódj.
7. Válassz hangot, végezz hangpróbát, majd indítsd az automatikus válaszadást.

A böngésző helyi hálózati engedélyt kérhet. Az összekötő csak a saját gép `127.0.0.1:21214` címén figyel, eredetellenőrzést és egyszer használatos, indításonként változó párosítási kódot használ. A kód nem TikTok-jelszó. Egyszerre egy stúdió kapcsolódhat. Megszakadás után kézzel csatlakozz újra. A párosítási kódot a stúdió nem menti el.

A csatlakoztatás nem indít automatikus beszédet: azt külön kell bekapcsolni. A sor legfeljebb 50 eseményt tart meg. A több részletben érkező ajándéksorozatot a lezárásakor egyszer kezeli. Az indulás előtti kommentelőzményeket nem olvassa fel. A vezérlő stúdiófül maradjon nyitva; a külön adásképablak csak a képet adja, a hang a stúdióban szól.

A `!zene pontos számcím` kérések az előre betöltött, közvetítésre jogosított zenékhez kapcsolódnak. Tetszőleges internetes zenét nem tölt le. A karakter- és hangbeállítások böngészőnként maradnak meg; a dalfájlokat minden új stúdiómunkamenetben újra be kell tölteni.

A tiktok-live-connector nem hivatalos TikTok-integráció, a működése változhat. A nyilvános adás olvasásához nem adunk át TikTok-jelszót vagy munkamenetsütit. Az aláíró szolgáltatás korlátja esetén a szolgáltató saját `EULER_STREAM_API_KEY` környezeti változója állítható be helyben; ezt ne illeszd a weboldalba. Egyedi stúdiódomainhez a `STUDIO_ORIGIN` változóval adható meg a pontos HTTPS-eredet.

Dokumentáció: https://github.com/zerodytrash/TikTok-Live-Connector
