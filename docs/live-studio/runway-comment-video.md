# Kommentből készülő beszélő videó

Az AI minden kommentből új Ali–Isti párbeszédet ír. Ali csípősen ugratja a pukkancs színpadi Istit, aki rövid felháborodás után önironikusan visszakozik. A jelmez nem határozza meg a beszédet; a kalózos szófordulatok tiltottak. A referencia-videók reakcióritmusa szolgált mintául; a videókat és mondataikat nem játsszuk vissza.

A Runway kapcsoló a közös jelenet ElevenLabs módjában minden megszólalást frissen renderel. Nem folyamatos WebRTC beszélgetés: a generálás alatt a sor vár. A hangot a vezérlőfül videóeleme játssza, a stúdió és a külön adásablak némított képe követi a lejátszási időt. A sor csak a teljes lejátszás után folytatódik. A mikrofonos AvatarPreview külön korábbi prototípus, nem szükséges ehhez a módhoz.

## Beállítás

- `RUNWAYML_API_SECRET`: meglévő Runway API-hozzáférés.
- `RUNWAY_AVATAR_ID`: Isti kész egyedi karakterének azonosítója.
- `RUNWAY_ALI_AVATAR_ID`: Ali kész egyedi karakterének azonosítója.
- `ELEVENLABS_API_KEY`: meglévő saját hangok hozzáférése. ElevenLabs Agent nem szükséges.
- A közös napi keretben `runway_reply_30s = 0.12 USD`, a meglévő `tts` keret változatlan.

A 16 kHz, 16 bites mono PCM hang mintaszáma alapján legfeljebb 30 másodperc engedélyezett. A Runway díja 2 kredit + minden 6 másodperc után 2 kredit: legfeljebb 12 kredit/megszólalás, 24 kredit/kétfős válasz. A webes Runway Pro-egyenleg különbözik az API-egyenlegtől. Hivatalos források: https://docs.dev.runwayml.com/guides/pricing/ és https://docs.dev.runwayml.com/api/ .

A szerver bejelentkezést, stúdiójogosultságot és azonos origint kér. A kérések felhasználóhoz kötött, feltételes R2 rekordot kapnak; ugyanaz az azonosító nem indíthat második fizetős munkát. Hiba után nincs automatikus újragenerálás. Stop esetén a saját feladat törlési kérését elküldjük; bizonytalan hálózati hibánál a már elindított, legfeljebb 30 másodperces generálás még befejeződhet és díjköteles marad.

## Indítás a közvetítő gépen

1. Nyisd meg a `/live-studio` oldalt. Ali–Mc Isti jelenet, ElevenLabs, AI válaszmód.
2. Jelöld be a Runway beszélő videót. Először 1 válasszal próbáld ki.
3. Nyisd meg a tiszta adásképet; a vezérlőfül maradjon nyitva, mert onnan jön a hang.
4. A TikTok LIVE Studio rögzítse az adásképet és a géphangot. A közvetítés indítása a LIVE Studio feladata.
5. Indítsd a `tools/tiktok-bridge` összekötőt ugyanezen a gépen, párosítsd, majd indítsd az automatikus válaszadást.

Ali új referenciaképe: `public/live-studio/ali-avatar.webp`. A beépített imagegen készítette a közös képből: Ali egyedül, kamerába néző mellportré, azonos arc, lila varázslójelmez és meleg kunyhóháttér; az ülő figura eltávolítása; szöveg nélkül. Az eredeti közös kép változatlan.

## Egyszeri ellenőrzés

Az `Egyszeri AI-videópróba` a beírt kommentből új párbeszédet készít, a kiválasztott saját hangokon és Runway-karaktereken lejátssza, majd megáll. Nem kell bekapcsolni az automatikus sort. A `Mindent leállít` gomb a készítés és a lejátszás alatt is használható. A sikeres próba bekerül a beszélgetési előzménybe.
