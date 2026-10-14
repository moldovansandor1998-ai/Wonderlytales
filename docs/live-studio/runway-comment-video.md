# Kommentből készülő beszélő videó

Az AI minden kommentből új Ali–Isti párbeszédet ír. Ali csípősen ugratja a pukkancs színpadi Istit, aki rövid felháborodás után önironikusan visszakozik. A jelmez nem határozza meg a beszédet; a kalózos szófordulatok tiltottak. A referencia-videók reakcióritmusa szolgált mintául; a videókat és mondataikat nem játsszuk vissza.

A Runway kapcsoló a közös jelenet ElevenLabs módjában minden megszólalást frissen renderel. Nem folyamatos WebRTC beszélgetés: a generálás alatt a sor vár. A vezérlőfül adásképének egyetlen videóeleme játssza a képet és a hangot; a külön számítógépes adásablak némított másolata követi a lejátszási időt. A sor csak a teljes lejátszás után folytatódik. A mikrofonos AvatarPreview külön korábbi prototípus, nem szükséges ehhez a módhoz.

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
5. A szerveres kommentkapcsolathoz add meg az aktív TikTok-felhasználónevet. Alternatívaként választható a `tools/tiktok-bridge` helyi összekötő. Kapcsolódás után indítsd az automatikus válaszadást.

Ali új referenciaképe: `public/live-studio/ali-avatar.webp`. A beépített imagegen készítette a közös képből: Ali egyedül, kamerába néző mellportré, azonos arc, lila varázslójelmez és meleg kunyhóháttér; az ülő figura eltávolítása; szöveg nélkül. Az eredeti közös kép változatlan.

## Egyszeri ellenőrzés

Az `Egyszeri AI-videópróba` a beírt kommentből új párbeszédet készít, a kiválasztott saját hangokon és Runway-karaktereken lejátssza, majd megáll. Nem kell bekapcsolni az automatikus sort. A `Mindent leállít` gomb a készítés és a lejátszás alatt is használható. A sikeres próba bekerül a beszélgetési előzménybe.

## Megőrzés és visszajátszás

Az elkészült Runway MP4 tartósan a tulajdonos saját médiatárába kerül; a stúdió és az adásablak az autentikált videóvégponton játssza le. A kész videó nem vész el a szolgáltatói URL lejáratakor. Sikertelen másoláskor a szolgáltatói lejátszás folytatódhat, a klipelőzmény jelzi a mentés hiányát. Az előzmény újranyitása csak az átvitelt próbálja újra, fizetős generálást nem indít.

A `Korábbi videók betöltése` az adott tulajdonos legutóbbi elérhető klipjeit mutatja (legfeljebb 12, a rekordlistázás meglévő korlátain belül). A sikeresen mentett videók az AI-videó médiagaléria kész videói között is elérhetők. Az előnézeti lejátszás automatikusan megáll adás/próba indításakor és a `Mindent leállít` gombbal is.

## 2026-10-14 ellenőrzés

Az első éles kiadás: PR #13, `d037e6c`. Két valódi AI-kommentpróba, négy saját ElevenLabs-hang és négy Runway-videó sikeresen elkészült és lejátszódott. A külön adásablakban Isti videója `readyState=4`, `paused=false`, 6.919 másodperces időtartammal megfigyelve. TikTok-közvetítés nem indult. A videógenerálás továbbra is várakozással jár, nem folyamatos valós idejű mozgás; a székben ülő két figura közös testanimációja nincs megvalósítva.

A mentési és újrajátszási javítás validációja: 51 célzott teszt, teljes Next.js build és workflow-buildellenőrzés sikeres.


## Telefonos adáskép és szerveres kommentkapcsolat

A „Telefonos adáskép – kép és hang együtt” ugyanazon böngészőfület váltja teljes képernyős, 9:16 nézetre. A fő videóelem a váltáskor nem cserélődik le. A kezelőszervek érintésre megjelennek és 6 másodperc után elbújnak. A Vissza csak a nézetet zárja; a Mindent leállít a lejátszást, a várakozó sort és a kommentkapcsolatot is leállítja. Támogatott böngészőben képernyő-ébresztést kérünk. A mentett klipek innen újra lejátszhatók új generálás nélkül.

A `/api/live-studio/tiktok` azonos eredetű, bejelentkezett stúdiófelhasználó WebSocket-kérését fogadja a Vercel Functions API-ján. Nyilvános kommentet, lezárt ajándéksorozatot és követést továbbít; TikTok-munkamenetet/jelszót nem fogad el. Nem küld TikTok-üzenetet és nem indít közvetítést. Ugyanazt a 2.5.0-s nem hivatalos összekötőt használja, mint a helyi bridge; az opcionális `EULER_STREAM_API_KEY` csak szerveroldali. Szolgáltatói hiba után nincs automatikus újrapróbálás. A 250 másodperces szerverkapcsolat tervszerű megújításakor a böngésző újracsatlakozik; az esetleges rés alatt érkező kommentek elveszhetnek. A sor stabil eseményazonosítókkal deduplikál; az ajándék elsőbbséget kap, de két ajándékreakció után várakozó komment következik. R2-ben felhasználónként feltételesen lefoglalt, lejáró lease korlátozza az aktív kapcsolatot egyre.

A „Telefonos kapcsolat ellenőrzése” ugyanazt az autentikált WebSocket-végpontot próbálja ki, de nem kapcsolódik TikTokhoz, nem foglal lease-t és nem generál semmit. Sikere nem igazolja a TikTok-szolgáltatói kapcsolatot.

A telefon TikTok Mobil játék képernyőközvetítése külön tesztelendő: a rendszerhang továbbítása, a böngésző előtérben tartása és a hálózati stabilitás készülékfüggő. A TikTok MI-jelölés legyen bekapcsolva. A Runway-generálás várakozási idejét a mobilnézet nem szünteti meg.


## Automata műsor

Az elsődleges indítás most az **Automata műsor indítása**. A saját TikTok-adás elindítása és a felhasználónév egyszeri megadása után ez egyben indítja a mozgó alapjelenetet, a kommentfigyelőt, az AI-válaszsort és a telefonos nézetet. A válaszvideókhoz nem kell a galériát kezelni.

- Az álló közös képből egyszer, Gen-4.5-tel 5 másodperces, 720×1280-as alapvideó készül. Rögzített árplafon 60 API-kredit ($0.60), a külön `runway_backdrop_5s` munkakeretből, a meglévő napi kereten belül, csak igazolt elegendő plafonnal. Tulajdonosonként egy feltételesen létrehozott `live-backdrop` rekord tartja meg. Ismételt indítás, dupla kattintás, újratöltés vagy bizonytalan hiba nem generál második alapvideót. A létrejött MP4 a saját médiagalériában megmarad.
- Ez a néma alapmozgás ismétlődik a nézői események között és a válaszra váráskor. Nem ismétel korábbi kommentválaszokat és nem indít folyamatos fizetős generálást üres adásban. Az egyszeri alapvideó elkészítése az oldal bezárása után is befejeződhet; a következő indítás a meglévő feladatot olvassa.
- Ajándék elfogadásakor a varázseffekt azonnal indul, a generálástól függetlenül. A név szerinti, új AI-reakció elsőbbséget kap a sorban. Már beszélő szereplőt nem vág félbe.
- A két új beszélő videó párhuzamosan készül. Csak mindkettő elkészülte után indulnak, Ali → Isti sorrendben, átfedő hang nélkül. Egy hiba vagy Stop mindkét függő munkát megszakítja. A későn elkészült videó nem indíthatja újra a leállított műsort.
- Két ajándék után egy várakozó komment kerül sorra. A korlát 50 esemény; megtelt sornál az új ajándék egy várakozó komment helyét átveheti, a kihagyásszámláló ezt jelzi.
- A **Mindent leállít** a válaszkészítést, a lejátszást, az alapvideót, a kommentkapcsolatot és a zenét megállítja. Szolgáltatói hiba és a beállított adáskorlát szintén megállítja a válaszadást.

Az **Automata műsorpróba – komment + ajándék** TikTok nélkül egy kommentet és egy 1,5 másodperccel később beérkező próbaajándékot ad ugyanahhoz az automatikus sorhoz. Két új AI-párbeszédet, négy hangot és négy Runway-klipet használ, majd magától leáll. Nem indít TikTok-közvetítést.

Korlát: ez folyamatos alapvideóval és automatikus friss válaszokkal működő műsor. A válaszok renderelési ideje megmarad; nem folyamatos WebRTC-testanimáció vagy azonnali szabad mozgás. A TikTok tényleges kommentfolyama és a telefon rendszerhangjának közvetítése külön éles próbát igényel.

## Telefonos hibajavítás – 2026-10-14

- Az alapvideó indulás előtt teljesen betöltődik a böngészőbe, majd helyi blob URL-ről ismétlődik. Nem kell minden körben autentikált média-kérést kiszolgálni. A blob az oldal bezárásakor felszabadul; a tartós eredeti változatlan.
- A leállítás után visszautasított, már érvénytelen `play()` kérés nem jelent új hibát. Előtérbe visszatérve a lejátszó folytatja a háttérvideót; az aktív indítás megszakítását korlátozottan újrapróbálja. A valódi dekódolási és böngészőengedély-hiba külön üzenetet kap.
- A TikTok terminális hibája a válaszsort állítja le, az alapvideót nem. A felületen a valódi kapcsolati ok marad meg. A Mindent leállít és a két eseményes próba vége továbbra is mindkét lejátszást megállítja.
- Az SDK kezdeti error eseménye helyett a `connect()` eredménye határozza meg a hibát: offline fiók, aláíró szolgáltatás, kapcsolódási korlát, időtúllépés vagy ismeretlen adáslekérési hiba. A napló csak biztonságos hibakódot és a szerveroldali aláírókulcs jelenlétét tartalmazza.
- Egy feldolgozhatatlan TikTok-üzenet nem bontja az egyébként működő kapcsolatot. Az opcionális ajándékkatalógus lekérése kikapcsolva; a natív ajándékeseményben szereplő nevet használjuk. A már létrejött kapcsolat hálózati megszakadását a böngésző 5/10/20 másodperces, legfeljebb három helyreállítási kísérlettel kezeli. Offline, szolgáltatói és kerethibára továbbra sincs automatikus újrapróbálás.
- A **Mentett alapvideó próbája – új generálás nélkül** csak a meglévő videót olvassa és játssza le, TikTok, AI-, hang- vagy videókészítés nélkül. Hiányzó alapvideó esetén nem küld POST kérést.

Célzott ellenőrzés: 28 teszt (késői play-megszakítás, telefonos előtérbe visszatérés, dekódolási hiba, TikTok offline ok megőrzése, nem végzetes eseményhiba, kapcsolat-helyreállítás, stream vége, költségvédelmek). Éles bejövő kommenthez továbbra is a felhasználó @azonosítója és aktív TikTok LIVE szükséges.

## Valódi TikTok-kommentek és ajándékok – protokolljavítás

A csatlakoztatott TikTok Live Connector 2.5.0 a protobuf v3 eseményeket adja át. A komment szövege `content`, az ajándék neve/típusa `gift.name` / `gift.type`, a felhasználó azonosítója `displayId`. A régi normalizáló kizárólag a korábbi `comment` / `giftDetails` mezőket olvasta, ezért az aktív kapcsolatról érkező kommentet üresként eldobta, az ajándéksorozatot pedig nem megfelelően kezelte. A közös szerveres/helyi adapter mindkét formátumot támogatja. A regressziós teszt az alkalmazásban telepített `tiktok-live-proto/v3` kódolójával és dekódolójával készít valódi bináris eseményt, és ellenőrzi a válaszsorba kerülést, az ajándéksorozat lezárását és a rózsaszirom-effektet.

A nézői TikTok-kép fekvő keretbe kicsinyített álló képernyője és a telefon mikrofonjának továbbítása külön közvetítési beállítás. A stúdió weboldala ezeket nem tudja átállítani. A mobil TikTok elrendezés- és hangbeállításait a készüléken kell ellenőrizni; az alapvideó néma, a beszélő klipek tartalmazzák a hangot.

## 2026-10-14: masked NPC show and cached music-gift reaction

The automatic show now generates fresh text and ElevenLabs speech only. It never
calls the per-reply Runway avatar-video endpoint. Ali wears a medical mask and
Isti an opaque black mouth cover in the new `ali-isti-masked.webp` reference.
The reference is an imagegen edit of the existing duo image; identities, costume,
room and camera are preserved, with the witch lowered into a resting pose.

Preparation is explicit and owner-scoped: three subtle 8-second idle variants
and one stand/gesture/sit reaction. Each uses Runway's `veo3.1_fast` with audio
false and the same image for first and last frame (80 API credits per clip,
320 total; current Runway pricing verified 2026-10-14). The dedicated budget
service is `runway_npc_8s: 0.80`; daily limit and all other services are unchanged.
The fixed angry Hungarian line is generated once per selected Isti voice with
Eleven v3 and saved to private R2. No automatic retry after uncertain submission.
MP4 assets and the source WebP are preserved in the owner's gallery.

The browser caches the complete clips and shout as blob URLs before starting.
Two video players keep the previous final frame visible until the next clip
plays; idle variants do not repeat consecutively. Reactions wait for the next
idle boundary, play once, and return to idle after both picture and voice finish.
The saved voice starts 1.6 seconds into the reaction. STOP aborts the voice and
pending reaction and stops music. Live output receives the active NPC frame.

Music is an original Web Audio instrumental arrangement, continuously composed
from changing chords, bass and mallet figures, with soft envelopes and reverb.
It is not a looping recording and incurs no generation charge. Speech ducks it;
video switches do not restart it. Optional uploaded tracks each play once per
page session then return to the evolving instrumental bed.

Native TikTok gift IDs are retained by the v3/legacy adapter. A configured exact
ID takes precedence over exact normalized names. Comments never trigger the
saved music-gift action. Default names are Zene, Music, Music Note, Musical Notes;
these are matching defaults, not a claim that a particular account's gift catalog
uses them. The operator can select an actually received gift from history.
Streak completion and event dedup remain upstream of the reaction queue.

Validation: targeted budget/idempotency, matching, native protocol and dialogue
checks; production build. Actual user-phone TikTok layout and system-audio
capture remain device checks; browser verification cannot prove those settings.
