# WonderlyTales – technológiai és költségvizsgálat

Ellenőrzés: 2026-10-10 UTC; a projekt költségkönyvének napja: 2026-10-11, Asia/Saigon.
Állapot: beszerzés előtti vizsgálat. Új vásárlás és fizetős generálás: 0. A/B videó még nincs.

## Döntési javaslat

Most nem javaslok havi előfizetést. Nincs bizonyítottan „szükséges” AI-modell, amely önmagában professzionális, 60 perces WonderlyTales-filmet állít elő. A szolgáltatás és a modell külön döntés: a Runway platform több gyártó modelljét is kínálja; a Seedance 2.5 ByteDance-modell.

Az első, költségtakarékos AI-próba jelöltje a **Kling O3 Pro Reference-to-Video a fal API-n**. A több nézetből megadott karakterreferencia és a külön helyszín-/stílusképek jól illenek az igényhez. A mozgásreferenciás változat külön, drágább végpont. Összehasonlító jelölt a **Seedance 2.5 1080p a Runway Dev API-n**, kép-, hang- és videoreferencia lehetőségével. Ez tesztre kiválasztott páros, nem mért minőségi rangsor. [1–4]

A teljes film alapjaként a saját 3D karakterekkel, megfelelő riggel, valódi mozgásanyaggal és arcanimációval vezérelt hibrid gyártást tartom a legjobban kontrollálható iránynak. Ez mérnöki következtetés: a szereplő, a tér és a tárgyérintkezés szerkeszthető marad. Az AI csak azokban a beállításokban kapna végső képelőállító szerepet, ahol a próba tényleges előnyt mutat. Nem állítom, hogy a jelenlegi V025 eléri ezt a szintet.

## A referenciafilm tényleges ellenőrzése

A megadott YouTube-oldal címe: „The Little Giant | ADVENTURES, ANIMATED | Full Movie in English”, csatorna: „Boxoffice | ANIMATION | Full Movies”. A lejátszó az ellenőrzéskor országkorlátozás miatt nem játszotta le a filmet. A mozgás, mimika, hang és effekt így nem volt közvetlenül elemezhető. A gyártószoftver és az AI-használat nem állapítható meg; nincs bizonyíték konkrét modellre.

Ezért egyik jelöltről sem állítom, hogy bizonyítottan az áll legközelebb a referenciához. Ehhez hozzáférhető filmrészlet és azonos jelenetből készült tényleges teszt szükséges. A videó címe és a szolgáltatók bemutatói nem helyettesítik ezt az összevetést.

## Runway: hozzáférés és számlázás

A csatlakoztatott Runway-fiók élő ellenőrzése: Free csomag, 0 kredit, elérhető videómodell nincs. A csatlakozás működik; generálást nem indítottam.

A Runway webes előfizetése és a fejlesztői API külön egyenleg. A ChatGPT-összekötés a webes krediteket használja, és nem támogatja az Explore korlátlan módját. Saját szerveres gyártáshoz az API a célszerű csatorna; egy Pro-előfizetés önmagában nem ad API-kreditet. [5–6]

A fiókban mutatott havi listaárak: Standard 15 USD / 625 kredit; Pro 35 USD / 2250 kredit; Max 95 USD / 9500 kredit. Éves és időszakos kedvezményt nem számítottam a gyártási költségbe. Ezek nem a teljes filmre szóló csomagárak. A fejlesztői API 0,01 USD/kredit; az induló feltöltés minimuma 10 USD, de ilyet sem vásároltam. [1,7]

## Kreditköltség: Seedance 2.5, 1080p

A listaár 68 kredit/kimeneti másodperc. Az alábbi számítás kép-/hangreferenciát feltételez, fizetős videóbemenet nélkül. Az ismétlésszám a legelső generálást is tartalmazza. A 3 és 5 próbálkozás érzékenységi forgatókönyv, nem mért selejtarány. [1]

| Elkészítendő hossz | 1 generálás | Összesen 3 generálás | Összesen 5 generálás |
|---|---:|---:|---:|
| 20 másodperc | 1360 kredit / 13,60 USD | 4080 / 40,80 USD | 6800 / 68,00 USD |
| 24 másodperc | 1632 / 16,32 USD | 4896 / 48,96 USD | 8160 / 81,60 USD |
| 30 másodperc | 2040 / 20,40 USD | 6120 / 61,20 USD | 10 200 / 102,00 USD |
| 60 perc | 244 800 / 2448 USD | 734 400 / 7344 USD | 1 224 000 / 12 240 USD |

Videoreferencia további 34 kredit/bemeneti másodperc. Azonos hosszúságú videóbemenettel a 24 másodperces, háromszoros próba 7344 kredit / 73,44 USD; a 60 perces megfelelője 1 101 600 kredit / 11 016 USD. Három 480p vázlat és egy sikeres 1080p véglegesítés elméleti képköltsége 24 másodpercre 30,72 USD, 60 percre 4608 USD; ebben nincs rossz véglegesítés vagy videóbemenet. A vázlat jóváhagyása nem bizonyítja a végleges változat minőségét. [1]

## Alternatívák azonos számítási alapon

USD, adó és utómunka nélkül. A 60 perces oszlopok 3600 felhasznált másodpercre, vágási ráhagyás nélkül készültek. A teszt az előkészített négy beállítás: 8 + 4 + 8 + 4 másodperc. A Veo 1080p nyolcmásodperces klipjei miatt ott próbálkozásonként 32 másodperc számlázódik. [8–9]

| Szolgáltatás / konkrét modell | USD / generált mp | 24 mp próba, 3 kör | 60 perc, 1 kör | 60 perc, 3 kör | 60 perc, 5 kör |
|---|---:|---:|---:|---:|---:|
| Runway / Seedance 2.5, 1080p | 0,68 | 48,96 | 2448 | 7344 | 12 240 |
| Runway / Seedance 2.0, 1080p | 0,40 | 28,80 | 1440 | 4320 | 7200 |
| Runway / WAN 3.0, 1080p | 0,20 | 14,40 | 720 | 2160 | 3600 |
| fal / Kling O3 Pro, képreferencia, saját generált hang nélkül | 0,112 | 8,06 | 403,20 | 1209,60 | 2016 |
| fal / Kling O3 Pro, videoreferencia | 0,168 | 12,10 | 604,80 | 1814,40 | 3024 |
| Google / Veo 3.1 Standard, 1080p | 0,40 | 38,40 | 1440 | 4320 | 7200 |
| Google / Veo 3.1 Fast, 1080p | 0,12 | 11,52 | 432 | 1296 | 2160 |
| Google / Veo 3.1 Lite, 1080p | 0,08 | 7,68 | 288 | 864 | 1440 |

A fal és Google közvetlenül pénzben áraz; ezekhez nem találtam ki Runway-krediteket. A Kling konkrét Pro végpontján a natív felbontást a tényleges fájllal és szolgáltatói igazolással még ellenőrizni kell; a „Pro” címke önmagában nem bizonyít natív 1080p-t. A táblázat ár-, nem minőségi rangsor. Források: [1–3,8].

További olcsóbb kísérlet a fal Wan 2.2 A14B: 0,08 USD/mp, de az ellenőrzött ajánlat 720p és 16 fps szerinti számlázás; nem azonos a 1080p24 céllal. Saját RunPod-futtatása külön mérendő GPU-idő/elfogadott másodperc alapján árazható. A nyílt Wan 2.2 tároló elérhető, de nem telepítettem és nem indítottam új GPU-t. [10–11]

## Mit tudnak, és mit kell még bizonyítani?

| Jelölt | Hasznos vezérlés | WonderlyTales-korlát |
|---|---|---|
| Kling O3 Pro | Több nézetes karakterelemek, helyszín-/stílusképek, kezdő/záró kép; külön videoreferencia | Ujjfogás, két szereplő kölcsönhatása és eredeti magyar szájmozgás még nem tesztelt. [2–4] |
| Seedance 2.5 | Kép-, hang-, videobemenet, hosszabb rövid klipek | Magasabb költség; a hangreferencia nem garantálja az eredeti hang és fonémák pontos megőrzését. [1,12] |
| Veo 3.1 Fast/Standard | Referenciaképek és filmes rövid videó; közvetlen API | 1080p kliphossz-korlát, magyar teljesítmény nincs igazolva. A Lite referenciavezérlése szűkebb. [9] |
| Gemini Omni 1.1 Flash | Többfordulós videószerkesztés, képi/videós referenciák | Az ellenőrzött dokumentáció szerint 720p natív, 1080p felskálázott; hangreferencia jelenleg nem támogatott. Nem első jelölt a kötött magyar hanghoz. [13] |
| Blender / Unreal / iClone-alapú 3D | Szerkeszthető csontváz, tér, kamera, érintkezés és arcmimika | Rigillesztés, jó mozgásanyag és művészi javítás szükséges; az eszközcsere önmagában nem oldja meg a minőséget. [14–17] |

Nincs ellenőrzött bizonyíték arra, hogy bármelyik felsorolt AI-modell önmagában több száz beállításon át hibátlan karakter-, helyszín- és stílusállandóságot garantál. Ez nem azt jelenti, hogy nem használhatók: minden jelenethez a jóváhagyott alapreferenciákat kell visszaadni, nem az előző generálás hibáit továbbörökíteni. A visszatérő erdő térszerkezetét 3D alaphelyszín és kameraterv rögzítené. A seed egyezése nem személyazonossági garancia.

A meglévő magyar ElevenLabs-felvételek maradnak a végső hangsáv forrásai. Egy néma AI-videóra rákevert eredeti felvétel még nem kész szinkron: külön arcanimáció vagy hangvezérelt teljesítmény és ellenőrzés szükséges. A Runway Act-Two hasznos egykarakteres teljesítményátvitel-jelölt, de nem automatikus megoldás a két szereplőre és a kéz–tárgy érintkezésre. [18]

## Professzionális 3D út

Márk meglévő meshének vizuális identitása megőrizhető új rig illesztésével. A Character Creator/AccuRIG humanoid út; Lili négylábú szereplőjének külön rig kell. Az iClone Windows-környezetet és megfelelő kereskedelmi licencet kíván; ilyen vásárlást nem indítottam. Blender Rigify és Unreal IK-retargeting alkalmas építőelem, de az utóbbi csak létező mozgást visz át, nem alkot magától jó színészi játékot. [14–17]

Az A próba valódi új rig-/mocap-/arcanimációs munkát igényel. A régi V025 újravágása vagy egy AI-val átfestett hibás járás nem tekinthető sikeres technológiaváltásnak. A mozgásminőség bizonyításához a felvételt oldalról, vágatlanul kell látni.

## Automatizálás és teljes gyártási költség

Mind a Runway Dev, a fal, mind a Google kínál programozható hozzáférést. Ez jelenetenkénti sorba állítást, állapotlekérdezést és mentést tesz lehetővé, nem egyetlen 60 perces garantált filmhívást. A modellverziót, bemeneti SHA-kat, promptot, költségfoglalást, feladatazonosítót, kimenetet és minőségi döntést tartósan kell tárolni. Az ismeretlen kimenetelű beküldést tilos automatikusan megismételni. [4–5,9]

A most elkészített elkülönített Runway-adapter ezt az alapot adja: tartós R2-foglalás, egyszeri beküldés, folytatható állapotlekérés, előzetes költségkapu. Az éles UI-ba nincs bekötve és a fizetős API-n nincs kipróbálva. A jelenlegi költségkönyvben nincs genvideo keret, ezért az éles indítás tiltott. A régi adapter többé nem ad vissza próbaeredményt sikeres valódi videóként.

Teljes költség = generálás + vágási ráhagyás + bemeneti videó + szinkron/arcanimáció + rig/animátori munka + képi/hangi utómunka + GPU/tárhely + licencek + adók.

Pusztán szemléltető keret, nem árajánlat: három generálási kör és 25% vágási ráhagyás mellett Kling képreferenciával 1512 USD, videoreferenciával 2268 USD, Seedance 2.5 képreferenciával 9180 USD a videó. Ha ezen felül feltételeznénk 300 munkaórát 30 USD/órán, a részösszeg 10 512 / 11 268 / 18 180 USD lenne, a többi tétel előtt. A 300 óra és az óradíj nem mért kapacitás vagy szakmai ajánlat; egy professzionális 60 perces film jóval több munkát is igényelhet. Megbízható végösszeg csak a próbán mért elfogadási arányból és munkaidőből adható.

A napi 200 USD plafon nem teljesfilmes keret. Csak a háromkörös alap-generálás Seedance-szel legalább 37, Kling képreferenciával legalább 7 ilyen keretnapot igényelne, minden más költség nélkül. Ez nem vállalt átfutási idő. A projektben most 52 USD foglalt a 200-ból; ez költségfoglalás, nem ellenőrzött számla. Új költés nem történt.

## Elkészült előkészítés és a bizonyítás feltétele

Elkészült a közös 24 másodperces jelenet terve és a meglévő magyar hangokból a közös WAV, külön dialógus-/ideiglenes zene–zaj sávval. Négy beállítás: járás/megállás, Lili válasza, vágatlan szilánkfelvétel, közös reakció. A hangágy ideiglenes; nem végleges filmes keverés. Nincs új TTS és nincs új A/B képanyag.

A próbahangok és a jelenetcsomag R2-mentését az automatikus jóváhagyási ellenőrzés elutasította: a konkrét privát fájlok és célhely külön engedélyezését igényli. Utólagos, csak olvasó ellenőrzés szerint a tervezett kísérleti prefix alá nem került fájl. A helyi csomag elkészült, más célhelyre nem kerülte meg a tiltást. Ez a kutatási jelentés és a kód mentését nem akadályozza.

A későbbi próba mindkét útján ugyanazokat a hangokat, történetet és időzítést kell használni. A vizsgálat legalább egyszer valós sebességgel, lassítva, valamint közeliben és oldalnézetben történjen. Bukási ok: karaktercsere, szem-/szájtorzulás, hibás ujj vagy tárgy, lábcsúszás, érintkezés átugrása, helyszínváltozás, látható magyar szinkroneltérés. A technikai siker és az 1080p fájlméret nem minőségi jóváhagyás.

A sikeres 24 másodperc után külön 12 beállításos, 72 másodperces folytonossági próba szükséges visszatérő helyszínnel, oldal-/hátulnézettel, eltérő fényekkel és érzelmekkel. Még ez sem bizonyít 60 percet, de feltárja a hosszú filmre skálázás fő hibáit. Mindkét teszt jelenleg NEM FUTOTT. A teljes forgatókönyv megőrzött; a korábbi kb. 39:54-es tervet nem nyújtjuk töltelékekkel 60 percre.

## Elsődleges források

1. Runway API árak: https://docs.dev.runwayml.com/guides/pricing/
2. Kling O3 Pro képreferencia és ár: https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video
3. Kling O3 Pro videoreferencia és ár: https://fal.ai/models/fal-ai/kling-video/o3/pro/video-to-video/reference
4. Kling O3 Pro API: https://fal.ai/models/fal-ai/kling-video/o3/pro/reference-to-video/api
5. Runway API és külön kreditkeret: https://help.runwayml.com/hc/en-us/articles/21668552945171-Runway-API-FAQs
6. Runway MCP számlázás: https://help.runwayml.com/hc/en-us/articles/51931843164691-Connecting-to-Runway-MCP
7. Runway Dev indulás: https://docs.dev.runwayml.com/guides/setup/
8. Google API árak: https://ai.google.dev/gemini-api/docs/pricing
9. Veo API és korlátok: https://ai.google.dev/gemini-api/docs/veo
10. Wan 2.2 fal: https://fal.ai/models/fal-ai/wan/v2.2-a14b/image-to-video
11. Wan 2.2 hivatalos forrás: https://github.com/Wan-Video/Wan2.2
12. Seedance 2.5 Runway: https://help.runwayml.com/hc/en-us/articles/53542207042323-Creating-with-Seedance-2-5
13. Gemini Omni API: https://ai.google.dev/gemini-api/docs/omni
14. AccuRIG: https://www.reallusion.com/character-creator/auto-rig.html
15. iClone: https://www.reallusion.com/iclone/download.html
16. Rigify: https://developer.blender.org/docs/features/animation/rigify/
17. Unreal retargeting: https://dev.epicgames.com/documentation/en-us/unreal-engine/ik-rig-animation-retargeting-in-unreal-engine
18. Act-Two: https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two

Az árak pillanatfelvételt jelentenek; vásárlás és futtatás előtt újra ellenőrizendők. A costs.json és a calculate-tech-ab-costs.py megismételhetővé teszi a számítást.
