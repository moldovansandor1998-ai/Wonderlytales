import type {SceneDefinition,SceneLine,CastKey,SceneState} from './episode-shared';
export const EPISODE_TITLE='Titokváros · 1. rész – A rossz kanyar';
const places:Record<string,string>={
street:'Titokváros napsütötte utcája: mészkő homlokzatok, zebra, fekete oszlopok, a túloldalon piros kávézónapellenző, távol modern tornyok.',
door:'Ugyanezen utca kőkapuja, Félix a kép jobb oldalán, kőpillér mellette, balra látszik a zebra és a piros napellenző.',
lane:'A kapu melletti keskeny járdaszakasz, folyamatos mészkő homlokzat, meleg délutáni fény.',
workshopOutside:'Rézrakpart utcafronti műhelye, sötétzöld faajtó réz kilinccsel, nagy kirakat, ugyanaz a délutáni fény.',
workshop:'Tilda műhelye: rézcsengős üvegezett bejárat balra, középen fa munkapad, rendezett kéziszerszámok, hátul régi várostérkép, jobbra hátsó ajtó és udvari átjáró. Meleg ablakfény.',
yard:'A műhely mészkőfalas belső udvara, mögöttük a sötétzöld hátsó ajtó, balra szűk átjáró az utcához. Ugyanaz a meleg délutáni fény.',
gallery:'Néra elegáns galériája, réz és szilvaszínű részletek, városmakett az asztalon, nagy ablak, meleg délutáni fény.'
};
type Seed=[string,string,string,CastKey[],string,[CastKey,string,number,'visible'|'offscreen'][],string];
const seeds=[
  [
    "Séta Titokvárosban",
    "Nyitány",
    "street",
    [
      "felix"
    ],
    "Félix a járdán a kamera felé sétál, körülnéz és mosolyog. A kamera egyenletes távolságban hátrafelé követi. Háttérben természetes gyalogosforgalom, autók és zöld villamos.",
    [],
    "Meglévő elfogadott klip. A villamos háttérforgalom."
  ],
  [
    "Az autó és a menekülés",
    "Nyitány",
    "street",
    [
      "felix"
    ],
    "Az ezüstszürke autó fékez a zebránál. Félix félreugrik, majd a túloldali kőkapu felé fut. Mozgása földhöz kötött, táskája követi a lendületét.",
    [],
    "Meglévő elfogadott klip. A túl szűk utolsó közeli előtt vagy mozgás közben vágható."
  ],
  [
    "Levegő a kapualjnál",
    "Találkozás",
    "door",
    [
      "felix"
    ],
    "Félix a kőkapunak támaszkodva kifújja magát. Jobb kezével fogja hátizsákja pántját, a bal karja természetesen lóg. Visszanéz az útra, füle megmozdul, arca megkönnyebbült, mégis éber. Stabil félközeli.",
    [
      [
        "felix",
        "Hűha! Ez aztán közel volt! Mi folyik itt ma?",
        1,
        "visible"
      ]
    ],
    "A futás hangja átvezet a kapualjba. Az eredeti arc a referencia, nem az elmosódott utolsó képkocka."
  ],
  [
    "Mira feltartóztatja",
    "Találkozás",
    "door",
    [
      "felix",
      "mira"
    ],
    "Mira balról belép a kőkapu elé, felismeri Félixet és megáll. Félix válla továbbra is a falnál, táskája nála. Mira nyugodtan a hátizsákra mutat.",
    [
      [
        "mira",
        "Félix. Most szépen leteszed a táskát.",
        2,
        "visible"
      ]
    ],
    "Félix jobbra, Mira balra. Mira hangja a vágás előtt is kezdődhet."
  ],
  [
    "Jó időzítés",
    "Találkozás",
    "door",
    [
      "felix",
      "mira"
    ],
    "Kétalakos félközeli. Félix ironikusan felvonja a szemöldökét. Mira a helyén marad, tekintete határozott. Félix mosolya a végén elhal, amikor az útra pillant.",
    [
      [
        "felix",
        "Magának mindig ilyen jó az időzítése?",
        0.6,
        "visible"
      ],
      [
        "mira",
        "Csak amikor te menekülsz.",
        5.2,
        "visible"
      ]
    ],
    "Azonos tekintettengely; a szájmozgást szereplőnként ellenőrizzük."
  ],
  [
    "Visszatérő jármű",
    "Találkozás",
    "street",
    [],
    "A szereplők nézőpontjából az ezüstszürke autó lassan újra megjelenik az út túloldalán. Közeli forgalmi részlet, a sofőr arca nem látható. Az autó megáll a piros napellenző közelében.",
    [],
    "A második klip autójának lámpája, színe és kerékformája legyen a referencia; itt válik gyanússá a visszatérés."
  ],
  [
    "Ismerős sofőr?",
    "Találkozás",
    "door",
    [
      "felix",
      "mira"
    ],
    "Mira követi Félix tekintetét, majd visszanéz rá. Félix kissé behúzza a nyakát és megszorítja a pántot. Finom fülmozgás és légzés, félközeli.",
    [
      [
        "mira",
        "Ismered a sofőrt?",
        0.7,
        "visible"
      ],
      [
        "felix",
        "Nem. De úgy látszik, ő szeretne megismerni.",
        3.7,
        "visible"
      ]
    ],
    "Az autó a tekintetirányban marad."
  ],
  [
    "Mi van a táskában?",
    "Találkozás",
    "door",
    [
      "felix",
      "mira"
    ],
    "Mira a táskára pillant. Félix a kabátját igazítja, tétovázik, majd Mira arcát figyeli. A kézmozdulat egyszerű, a hátizsák nem tűnik el.",
    [
      [
        "mira",
        "Mi van a táskában?",
        0.5,
        "visible"
      ],
      [
        "felix",
        "Most már én is szeretném tudni.",
        4,
        "visible"
      ]
    ],
    "A táska tartalma még nem látszik."
  ],
  [
    "A megbízó hívása",
    "A műhely felé",
    "door",
    [
      "felix"
    ],
    "Félix egyik kezével előveszi telefonját. Egy pillanatra megáll a mozdulata, és elutasítja a hívást. A kijelző távol marad, olvasható generált szöveg nélkül.",
    [
      [
        "mira",
        "Valami fontos?",
        3,
        "offscreen"
      ],
      [
        "felix",
        "Csak egy elégedetlen ügyfél.",
        5,
        "visible"
      ]
    ],
    "A telefon a végén visszakerül a zsebébe; külön tárgyképnél rögzítjük a formáját."
  ],
  [
    "A rossz válasz",
    "A műhely felé",
    "door",
    [
      "felix",
      "mira"
    ],
    "Mira félrebillenti a fejét, a jelvényére pillant, majd Félixre. Félix zavart mosollyal vállat von. A feszültség oldódik, de nem tűnik el.",
    [
      [
        "mira",
        "A betörés sértettjét újabban ügyfélnek hívod?",
        1,
        "visible"
      ],
      [
        "felix",
        "Próbálok udvarias lenni.",
        6,
        "visible"
      ]
    ],
    "Az előző beszélgetés szünet nélkül folytatódik."
  ],
  [
    "Mira segítséget kér",
    "A műhely felé",
    "door",
    [
      "mira",
      "felix"
    ],
    "Mira a vállán lévő rádióhoz nyúl, miközben az autót figyeli. Félix mellette marad, nem szökik el. Közeli Mira arcán, Félix a háttérben.",
    [
      [
        "mira",
        "Rézrakpart, északi sarok. Gyanús jármű követ egy tanút. Erősítést kérek.",
        1,
        "visible"
      ]
    ],
    "A rádió válasza csak rövid sercegés, új beszélőhang nélkül."
  ],
  [
    "Biztonságos bejárat",
    "A műhely felé",
    "lane",
    [
      "felix",
      "mira"
    ],
    "Mira int, hogy Félix menjen vele a közeli műhelybe. Ketten balról jobbra elindulnak a homlokzat mellett. Egyenletes oldalirányú kamerakövetés.",
    [
      [
        "felix",
        "Én inkább másfelé mennék.",
        1,
        "visible"
      ],
      [
        "mira",
        "Észrevettem.",
        5,
        "visible"
      ]
    ],
    "A kőkaputól néhány métert tesznek meg, nincs teleportálás."
  ],
  [
    "Tilda műhelye",
    "A műhely",
    "workshopOutside",
    [
      "felix",
      "mira"
    ],
    "A rézkeretes műhelyajtóhoz érnek. Az ablakon át meleg fény és szerszámok látszanak. Félix az ajtóhoz nyúl, Mira követi.",
    [],
    "Új helyszín bemutatója; a műhely közvetlenül a korábbi utca mellett."
  ],
  [
    "Az ajtócsengő",
    "A műhely",
    "workshop",
    [
      "felix",
      "mira",
      "tilda"
    ],
    "Az ajtó kinyílik, a kis rézcsengő megrezdül. Tilda a munkapadtól felnéz. Félix belép, Mira az ajtó közelében marad.",
    [
      [
        "tilda",
        "Ha megint csak kölcsönkérni jöttél, zárva vagyunk.",
        2,
        "visible"
      ]
    ],
    "Tilda hátul a pultnál, az ajtó a kép bal szélén."
  ],
  [
    "Nem egyedül érkezett",
    "A műhely",
    "workshop",
    [
      "tilda",
      "mira",
      "felix"
    ],
    "Tilda észreveszi Mira jelvényét. Leteszi a kezében tartott rongyot, majd sokatmondóan Félixre néz. Mira röviden bólint.",
    [
      [
        "tilda",
        "Ó. Ma házhoz hoztad a rendőrséget.",
        1,
        "visible"
      ],
      [
        "felix",
        "Teljes körű szolgáltatás.",
        6,
        "visible"
      ]
    ],
    "Ugyanaz a pult és szerszámrend."
  ],
  [
    "Régi ismerősök",
    "A műhely",
    "workshop",
    [
      "tilda",
      "felix"
    ],
    "Félix közelebb lép a pulthoz. Tilda karba teszi a kezét. Félix mosolyogni próbál, aztán komolyabbá válik.",
    [
      [
        "felix",
        "Tilda, most tényleg segítség kell.",
        1,
        "visible"
      ],
      [
        "tilda",
        "Akkor most tényleg mondd az igazat.",
        5,
        "visible"
      ]
    ],
    "A kedélyes hang után komolyabb fordulat."
  ],
  [
    "A réztok a pulton",
    "A műhely",
    "workshop",
    [
      "felix",
      "mira"
    ],
    "Félix leveszi a hátizsákját, a pultra teszi, és előemel egy kisméretű, lezárt réz irattokot. Mira közelről figyel. Egyetlen világos tárgymozdulat.",
    [],
    "Kellék: 25 cm-es hengeres réztok, zöldes patina, kerek városi pecsét. A hátizsák a pulton marad."
  ],
  [
    "Tilda felismeri a pecsétet",
    "A műhely",
    "workshop",
    [
      "tilda"
    ],
    "Tilda leereszti nagyítószemüvegét és közelebb hajol a réztok pecsétjéhez. A tok még zárt. Arcán felismerés jelenik meg.",
    [
      [
        "tilda",
        "Ezt a pecsétet harminc éve nem használják.",
        2,
        "visible"
      ]
    ],
    "Tárgyközeli helyett a reakció viszi a jelenetet."
  ],
  [
    "Régi városi iratok",
    "A műhely",
    "workshop",
    [
      "tilda",
      "mira"
    ],
    "Tilda a réztok jelvényére mutat, Mira noteszt vesz elő. Tilda a műhely hátsó falán függő régi várostérképre néz.",
    [
      [
        "mira",
        "Milyen iratokhoz tartozott?",
        1,
        "visible"
      ],
      [
        "tilda",
        "Rézrakpart eredeti tulajdoni irataihoz.",
        4.5,
        "visible"
      ]
    ],
    "Mira tollal jegyzetel; nincs véletlenül megjelenő képernyő."
  ],
  [
    "Az igazság ára",
    "A műhely",
    "workshop",
    [
      "tilda",
      "felix"
    ],
    "Tilda kérdő tekintettel Félix elé tolja a tokot. Félix lesüti a szemét, megvakarja tarkóját. A kamera helyben marad.",
    [
      [
        "tilda",
        "Ugye nem egy múzeumtól kölcsönözted?",
        1,
        "visible"
      ],
      [
        "felix",
        "Magángyűjtemény.",
        5,
        "visible"
      ]
    ],
    "Félix nem válik ártatlan félreértés áldozatává."
  ],
  [
    "A megbízás",
    "A műhely",
    "workshop",
    [
      "felix"
    ],
    "Félix a pultra támaszkodik és magyarázni kezd. Kezei láthatók, gesztusai visszafogottak. A tok a kép előterében marad.",
    [
      [
        "felix",
        "Azt mondták, egy régi gyűjtői darab. Beviszem, átadom, megkapom a pénzem.",
        1,
        "visible"
      ]
    ],
    "A karakter saját döntéséről beszél, nem narrációs visszaemlékezés."
  ],
  [
    "Mira pontosít",
    "A műhely",
    "workshop",
    [
      "mira",
      "felix"
    ],
    "Mira becsukja a noteszt, felnéz Félixre. Félix elhallgat, és egy pillanatra megpróbál félrenézni.",
    [
      [
        "mira",
        "És az irattár ajtaját ki nyitotta ki neked?",
        1,
        "visible"
      ],
      [
        "felix",
        "Az ajtó nem volt túl együttműködő.",
        5,
        "visible"
      ]
    ],
    "Nem mutatunk betörési technikát; a személyes konfliktus a lényeg."
  ],
  [
    "A beismerés",
    "A műhely",
    "workshop",
    [
      "felix",
      "mira"
    ],
    "Félix sóhajt, felhagy a viccelődéssel, és egyenesen Mirára néz. Mira nem szakítja félbe.",
    [
      [
        "felix",
        "Rendben. Én törtem be. Én hoztam el.",
        1,
        "visible"
      ]
    ],
    "A jelenet fordulópontja: világos, saját felelősségvállalás."
  ],
  [
    "Két külön ügy",
    "A műhely",
    "workshop",
    [
      "mira"
    ],
    "Mira határozottan, csendesen válaszol. Röviden az utcai ablakra néz, majd ismét Félixre.",
    [
      [
        "mira",
        "A lopást nem felejtjük el. De előbb kiderítjük, ki akar elhallgattatni.",
        1,
        "visible"
      ]
    ],
    "A rendőrnő nem ad azonnali felmentést."
  ],
  [
    "Az ablakon túl",
    "A műhely",
    "workshop",
    [
      "mira"
    ],
    "Mira az ablakhoz lép, a függöny szélét kicsit félrehúzza. Az ezüst autó az út túloldalán áll. Csak a kabátos sofőr bizonytalan körvonala látszik.",
    [],
    "A kocsi azonos a korábbi felvétellel. A néző most Mirával együtt figyel."
  ],
  [
    "Oszkár befut",
    "A szemtanú",
    "workshopOutside",
    [
      "oszkar"
    ],
    "Oszkár kerékpárját a műhely elé tolja és sietve leszáll. Sisakja és futártáskája rajta marad. Az ajtóhoz lép.",
    [],
    "A bicikli egyszerű, bordó vázas; ezt a kelléket később is megtartjuk."
  ],
  [
    "Nem csomagot hozott",
    "A szemtanú",
    "workshop",
    [
      "oszkar",
      "tilda"
    ],
    "Oszkár belép a csengő alatt. Tilda felé fordul, levegőt vesz, aztán észreveszi a többieket.",
    [
      [
        "oszkar",
        "Tilda! Az a szürke kocsi megint itt van.",
        1,
        "visible"
      ],
      [
        "tilda",
        "Te ismered?",
        6,
        "visible"
      ]
    ],
    "A csengő hangja az ajtónyitással egy időben hallatszik."
  ],
  [
    "Az irattár előtt",
    "A szemtanú",
    "workshop",
    [
      "oszkar",
      "mira"
    ],
    "Mira Oszkárhoz fordul. Oszkár az ablak irányába mutat, majd a futártáskájából elővesz egy összehajtott szállítólevelet.",
    [
      [
        "oszkar",
        "Reggel az irattár előtt állt. Ugyanez az autó.",
        1,
        "visible"
      ]
    ],
    "A szemtanú állítása új információ; még ellenőrzendő."
  ],
  [
    "A szállítólevél",
    "A szemtanú",
    "workshop",
    [
      "oszkar",
      "mira"
    ],
    "Oszkár átadja a szállítólevelet Mirának. Mira rápillant és elteszi a noteszéhez. A papíron nem szerepel olvasható generált szöveg.",
    [
      [
        "oszkar",
        "Ide vittem a csomagot. A címet megőriztem.",
        1,
        "visible"
      ],
      [
        "mira",
        "Jól tetted.",
        6,
        "visible"
      ]
    ],
    "Papírbetéthez később külön, pontosan szerkesztett grafika használható."
  ],
  [
    "Összeáll a kapcsolat",
    "A szemtanú",
    "workshop",
    [
      "mira",
      "felix"
    ],
    "Mira Félixre néz, majd a réztokra. Félix ráébred, hogy a megbízás nagyobb ügy része; a mosolya eltűnik.",
    [
      [
        "mira",
        "Már azelőtt vártak rád, hogy kijöttél.",
        1,
        "visible"
      ],
      [
        "felix",
        "Ez nem szerepelt a megbízásban.",
        5,
        "visible"
      ]
    ],
    "Ugyanaz a pult, táska és tok."
  ],
  [
    "Árnyék a bejáratnál",
    "A szemtanú",
    "workshop",
    [
      "tilda"
    ],
    "Tilda a bejárat felé pillant. A műhely tejüveges ajtaja mögött egy magas, kabátos állatalak árnyéka megáll. A kilincs még mozdulatlan.",
    [],
    "Néma mellékalak, nem kap új hangot. A testét az üveg takarja."
  ],
  [
    "A műhely bezár",
    "A szemtanú",
    "workshop",
    [
      "tilda",
      "oszkar"
    ],
    "Tilda int Oszkárnak. Oszkár lehúzza az ablak belső árnyékolóját. Tilda bezárja az ajtó reteszét, majd visszalép a pulthoz.",
    [
      [
        "tilda",
        "Ma korábban zárunk.",
        2,
        "visible"
      ]
    ],
    "Az ajtó helyét és a hátsó kijárat irányát mutassuk világosan."
  ],
  [
    "A tok felnyílik",
    "Az iratok",
    "workshop",
    [
      "tilda",
      "mira"
    ],
    "Mira mellett Tilda a pultra fektetett réztok fedelét egyszerű mozdulattal leemeli. Összegöngyölt papírok látszanak benne. Nem mutatunk technikai zárfeltörést.",
    [],
    "A tokot kizárólag itt nyitják fel, korábban végig zárt."
  ],
  [
    "Az első lap",
    "Az iratok",
    "workshop",
    [
      "mira",
      "felix"
    ],
    "Mira óvatosan kiveszi a felső iratot. Félix a válla fölött néz rá. A papíron dombornyomott pecsét és halvány telekrajz látszik, olvasható betűk nélkül.",
    [
      [
        "felix",
        "Ezért a pár papírért majdnem elütöttek?",
        1,
        "visible"
      ]
    ],
    "Mira kezében marad az irat; a hátizsák a pulton."
  ],
  [
    "Rézrakpart térképe",
    "Az iratok",
    "workshop",
    [
      "tilda",
      "mira"
    ],
    "Tilda kiterít egy régi térképet az irat mellé. A műhely környékének háztömbjeire mutat. Mira összehasonlítja a két lapot.",
    [
      [
        "tilda",
        "Ezek a házak. Ez pedig a műhely telke.",
        1,
        "visible"
      ]
    ],
    "Rögzített térképkellék; konkrét feliratok utólag szerkesztendők."
  ],
  [
    "A kiürítési értesítés",
    "Az iratok",
    "workshop",
    [
      "tilda"
    ],
    "Tilda a pult fiókjából elővesz egy újabb, világos színű borítékot, és az iratok mellé helyezi. Aggodalma most először látszik.",
    [
      [
        "tilda",
        "Tegnap azt írták, az egész sor veszélyessé vált.",
        1,
        "visible"
      ]
    ],
    "A boríték azonos minden későbbi betétben."
  ],
  [
    "Hamis adatok",
    "Az iratok",
    "workshop",
    [
      "mira"
    ],
    "Mira a régi és az új irat között járatja a tekintetét. Ujjával két eltérő pecsétre mutat, majd határozottan felnéz.",
    [
      [
        "mira",
        "Más a tulajdonos. Más a telekhatár. Valaki átírta az iratokat.",
        1,
        "visible"
      ]
    ],
    "A csalás felismerése, nem technikai képernyőmontázs."
  ],
  [
    "Félix ráébred",
    "Az iratok",
    "workshop",
    [
      "felix",
      "tilda"
    ],
    "Félix Tildára néz, majd a jól ismert műhelyen végigpillant. Keze elengedi a pult szélét. Tilda nem kerüli a tekintetét.",
    [
      [
        "felix",
        "Ha ezek eltűnnek…",
        1,
        "visible"
      ],
      [
        "tilda",
        "A műhelyem is eltűnik.",
        4.5,
        "visible"
      ]
    ],
    "Rövid csend marad a mondat után; az érzelmi tétnek legyen ideje."
  ],
  [
    "Néra várakozik",
    "A veszély közelebb ér",
    "gallery",
    [
      "nera"
    ],
    "Néra elegáns galériájában egy városmakett mellett áll, telefonját a kezében tartja. Nyugodt arccal újra hívást indít. Finom kameraközelítés nélkül, stabil félközeli.",
    [],
    "Új helyszín: szilvaszínű és réz tónusok. Csak Néra látható."
  ],
  [
    "Elutasított hívás",
    "A veszély közelebb ér",
    "workshop",
    [
      "felix",
      "mira"
    ],
    "Félix telefonja újra rezeg. Mira figyeli. Félix ránéz a kijelzőre, majd képernyővel lefelé a pultra teszi.",
    [
      [
        "mira",
        "A megbízó?",
        1,
        "visible"
      ],
      [
        "felix",
        "Majd visszahívom.",
        5,
        "visible"
      ]
    ],
    "Félix még titkolózik; a telefon a pulton marad."
  ],
  [
    "A kilincs megmozdul",
    "A veszély közelebb ér",
    "workshop",
    [],
    "Közeli a réz ajtókilincsen és a belső reteszen. A kilincs lassan lenyomódik, majd visszaáll. Az ajtó mögötti árnyék mozdulatlan.",
    [],
    "Fémkattanás és halk utcai háttér. Nincs zenei lezárás."
  ],
  [
    "Mira közbelép",
    "A veszély közelebb ér",
    "workshop",
    [
      "mira",
      "felix"
    ],
    "Mira az ajtó felé lép, Félixet a pult mögött tartja egy kézmozdulattal. A tejüveg mögötti néma alak sötét körvonala közelebb kerül.",
    [
      [
        "mira",
        "Rendőrség. Lépjen el az ajtótól.",
        1,
        "visible"
      ]
    ],
    "Mira nem ránt elő fegyvert; a tér tiszta és követhető."
  ],
  [
    "Az ajtó megremeg",
    "Menekülés",
    "workshop",
    [
      "mira",
      "tilda"
    ],
    "Az ajtó egyetlen erős lökést kap kívülről. Mira és Tilda belülről megtámasztják. A retesz a helyén marad, az üveg nem törik szilánkosra.",
    [],
    "Rövid, egyszerű akció. Nincs sérülés vagy véletlen helyszínváltás."
  ],
  [
    "Papírok a földön",
    "Menekülés",
    "workshop",
    [
      "felix"
    ],
    "A rezgéstől néhány irat lecsúszik a pultról. Félix utánuk kap és leguggol. A telefon és a réztok a pulton marad.",
    [
      [
        "tilda",
        "Hátsó ajtó! Oszkár, a reteszt!",
        1,
        "offscreen"
      ]
    ],
    "A leesett iratok helyét rögzítjük, a következő képen is ott legyenek."
  ],
  [
    "A hátsó folyosó",
    "Menekülés",
    "workshop",
    [
      "oszkar"
    ],
    "Oszkár a munkapadok között a hátsó ajtóhoz siet. Oldalirányú követés, ugyanabban az irányban. Sisakját nem veszi le.",
    [],
    "A hátsó kijárat a műhely bejáratával ellentétes oldalon."
  ],
  [
    "Kinyílik a kijárat",
    "Menekülés",
    "yard",
    [
      "oszkar",
      "tilda"
    ],
    "Oszkár belülről felhúzza a nagy reteszt és kitárja a hátsó ajtót. A napsütötte belső udvar feltárul. Tilda belép a képbe.",
    [
      [
        "oszkar",
        "Nyitva! Gyertek!",
        2,
        "visible"
      ]
    ],
    "Egyszerű kézmozdulat, nincs összetett gépezet."
  ],
  [
    "Félix kijuthatna",
    "A döntés",
    "yard",
    [
      "felix"
    ],
    "Félix a nyitott hátsó ajtóban áll, hátizsákját már visszavette. Szabad átjáró vezet a szomszéd utcába. Egy lépést tesz kifelé, majd megáll.",
    [],
    "A hátizsák visszavétele a vágás előtt vagy rövid mozdulatként látszódjon; az iratok még Miránál."
  ],
  [
    "Mira a bizonyítékért nyúl",
    "A döntés",
    "workshop",
    [
      "mira"
    ],
    "Mira a pulthoz lép és összefogja az iratokat. A bejárati ajtó újabb lökést kap, a szerszámos állvány enyhén megbillen. Mira hátrébb lép.",
    [],
    "Nincs súlyos becsapódás; a veszély érthető, nem kaotikus."
  ],
  [
    "Félix visszafordul",
    "A döntés",
    "workshop",
    [
      "felix"
    ],
    "Félix az udvari ajtóból Mirára néz. Egy pillanatnyi habozás után visszalép a műhelybe. Határozott, rövid mozgás, nincs hősies póz.",
    [],
    "A döntést a tekintet és a visszalépés mutatja."
  ],
  [
    "Segítő kéz",
    "A döntés",
    "workshop",
    [
      "felix",
      "mira"
    ],
    "Félix Mira alkarjáért nyúl, és átsegíti a hátsó ajtó küszöbén. Mira az iratokat a másik kezével a mellkasához szorítja. A mozdulat rövid és fizikailag hihető.",
    [
      [
        "felix",
        "Most az egyszer bízz bennem.",
        1,
        "visible"
      ]
    ],
    "Két karakter, természetes végtagok; a fogás helyét figyelni kell."
  ],
  [
    "Megmaradnak az iratok",
    "A döntés",
    "yard",
    [
      "mira",
      "felix"
    ],
    "Mira és Félix kiérnek az udvarra. Egy kilógó papírlap lebbenni kezd, Félix a csomag tetejére szorítja. Mindketten megállnak.",
    [],
    "Az iratköteg végig Mira kezében marad."
  ],
  [
    "Tilda bezárja az ajtót",
    "A döntés",
    "yard",
    [
      "tilda",
      "oszkar"
    ],
    "Tilda az udvar felől becsukja a műhely hátsó ajtaját és ráfordítja a külső záróvasat. Oszkár a közelében figyel, készen a segítségre.",
    [
      [
        "tilda",
        "Ezt a zárat én csináltam.",
        2,
        "visible"
      ]
    ],
    "A bejárati veszélyt rövid időre elzárják, nem győznek le egész szervezetet."
  ],
  [
    "Távolodó motor",
    "Lezárás",
    "yard",
    [
      "mira",
      "felix"
    ],
    "Mira és Félix a fal mellett figyelnek. Távolról felpörög egy motor, majd halkul. Mira óvatosan az utcai átjáró felé pillant.",
    [],
    "Hangátvezetés: a veszély távolodik, a zene nem áll meg hirtelen."
  ],
  [
    "Egy pillanatnyi megkönnyebbülés",
    "Lezárás",
    "yard",
    [
      "tilda",
      "oszkar"
    ],
    "Oszkár a falnak támaszkodik és lihegve elmosolyodik. Tilda megigazítja munkakötényét és végignéz a társaságon.",
    [
      [
        "oszkar",
        "Ez a kör nem szerepelt a futárútvonalban.",
        1,
        "visible"
      ],
      [
        "tilda",
        "Túlórának számoljuk.",
        6,
        "visible"
      ]
    ],
    "Rövid humor az akció után."
  ],
  [
    "Ki bízott meg?",
    "Lezárás",
    "yard",
    [
      "mira",
      "felix"
    ],
    "Mira Félix mellé lép. Már nyugodtabb, de határozott. Félix a kijáratra néz, aztán ezúttal visszanéz Mira szemébe.",
    [
      [
        "mira",
        "Most már mondd el. Ki bízott meg?",
        1,
        "visible"
      ]
    ],
    "A kapcsolatban megjelenik az első bizalom, a nyomozás folytatódik."
  ],
  [
    "Néra neve",
    "Lezárás",
    "yard",
    [
      "felix",
      "mira"
    ],
    "Félix rövid hallgatás után kimondja a nevet. Mira figyelmesen bólint, és előveszi a noteszét. Nem fordít hátat Félixnek.",
    [
      [
        "felix",
        "Néra. A galériából.",
        1,
        "visible"
      ],
      [
        "mira",
        "Akkor vele folytatjuk. Együtt.",
        5,
        "visible"
      ]
    ],
    "Nincs felmentés; Félix tanúként és gyanúsítottként is az ügy része."
  ],
  [
    "Első bizalom",
    "Lezárás",
    "yard",
    [
      "mira",
      "felix"
    ],
    "Félix egy félmosollyal Mirára pillant. Mira röviden viszonozza, majd a többiek felé fordul. Apró gesztus, visszafogott vonzalom, nincs csók.",
    [
      [
        "felix",
        "Együtt? Ez most meghívás?",
        1,
        "visible"
      ],
      [
        "mira",
        "Idézés.",
        5,
        "visible"
      ]
    ],
    "A romantika lassan épül. A városi zene átvezet Néra jelenetébe."
  ],
  [
    "A műhely a célpont",
    "Fordulat",
    "gallery",
    [
      "nera"
    ],
    "Néra a városmakett fölé hajol, és leemeli róla Tilda műhelyének kis réz épületét. Telefonját a füléhez emeli. Mosolya eltűnik, tekintete hidegebb lesz.",
    [
      [
        "nera",
        "A tok ráér. Előbb a műhely.",
        2,
        "visible"
      ]
    ],
    "Néma telefonpartner. Ez az epizód függővége, innen indulhat a második rész."
  ]
] as Seed[];
const shotId=(i:number)=>`a1700001-2026-4011-8010-${String(i).padStart(12,'0')}`;
const visual='Filmes minőségű, részletes 3D állatkarakter-animáció. Egyetlen 16:9 beállítás. Az elfogadott arcok, bundák, testarányok, ruhák és kellékek maradjanak azonosak.';
const motion=' Természetes testsúly, finom fül- és ruhamozgás. Stabil kamera, nincs véletlen zoom, belső vágás vagy áttűnés. Élő környezet. Csak környezeti hangok és hangeffektek, beszéd és önálló zenei lezárás nélkül; a rögzített magyar karakterhang külön készül.';
export const EPISODE_SCENES:SceneDefinition[]=[
{id:shotId(0),order:0,title:'Főcím · WonderlyTales / Titokváros',act:'Főcím',location:'Titokváros tetőterasz',duration:10,characters:['felix'],kind:'intro',imagePrompt:'Félix a jóváhagyott főcím tetőteraszán, modern napfényes városi panoráma. A címek külön grafikai rétegek.',prompt:'A már elkészült, jóváhagyott 10 másodperces főcím használata.',dialogue:[{character:'felix',text:'Iratkozz fel a csatornára!',offset:5.65,delivery:'visible'}],continuity:'Kész főcím. Egyszer kerül a film elejére, nem generáljuk újra.'},
...seeds.map((s,i):SceneDefinition=>({id:shotId(i+1),order:i+1,title:s[0],act:s[1],location:places[s[2]],duration:10,characters:s[3],kind:'story',imagePrompt:`${visual} ${places[s[2]]} Következő beállítás tiszta kezdőképe: ${s[4]} A mozgás első pillanatát mutasd. Teljes fej és fülek a képen. Nincs képfelirat vagy kollázs.`,prompt:`${visual} ${places[s[2]]} ${s[4]}${motion}`,dialogue:s[5].map(l=>({character:l[0],text:l[1],offset:l[2],delivery:l[3]})),continuity:s[6]})),
{id:shotId(59),order:59,title:'Záró főcím · Folytatjuk',act:'Befejezés',location:'Titokváros esti panorámája',duration:10,characters:[],kind:'outro',imagePrompt:'Titokváros eredeti modern mészkő és üveg épületekből álló panorámája, a délutánból estébe forduló meleg fény, ablakok fényei. Filmes 3D animáció, 16:9. Nyugodt üres tér a külön hozzáadandó feliratoknak. Nincs generált szöveg.',prompt:'Egyetlen lassú, stabil panorámabeállítás Titokváros fölött. Ablakfények gyulladnak, a forgalom apró mozgása látszik. Nincs zoom, véletlen vágás vagy beszéd. A WonderlyTales zárófeliratait és a főcím zenei motívumát külön vágjuk hozzá.',dialogue:[],continuity:'10 másodperces zárás; szerkesztett feliratok és a főcím visszatérő zenei motívuma külön sávon.'}
];
export function defaultSceneState(d:SceneDefinition):SceneState{return {id:d.id,revision:0,updatedAt:'',mode:'image',imagePrompt:d.imagePrompt,prompt:d.prompt,characters:[...d.characters],dialogue:d.dialogue.map(l=>({...l})),imageApproved:false,videoHistory:[],imageHistory:[],recordings:{},review:'pending',note:d.continuity,trimStart:0,trimEnd:10,sound:true};}

export function normalizeSceneState(s:SceneState):SceneState {return s.id===EPISODE_SCENES[0].id&&!s.dialogue.length?{...s,dialogue:EPISODE_SCENES[0].dialogue.map(l=>({...l}))}:s;}
