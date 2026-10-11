# Titokváros — Maya / Unreal gyártási ág

Átadás: 2026-10-11. **A professzionális Félix-rig, Unreal utca és 30 másodperces
film még NEM készült el.** A Maya–Unreal átvitelt nem sikerült futtatni, mert
egyik alkalmazás sincs a hozzáférhető gépen. A kód fordíthatósága nem átviteli teszt.

## Ténylegesen elvégzett munka

- GitHub és Vercel kiadás egyezése; Supabase olvasás; R2-fájl méret/hash;
  RunPod `/health`: egy egészséges, üres worker, nulla futó/várakozó munka.
- A feltöltött Tripo FBX valódi importja és három semleges ellenőrző render.
  Egy háló, 5394 csúcs, 6039 lap (4563 négyszög / 1476 háromszög), 182 nyitott
  határél. Nincs rig, súlyozás, UV, textúra, arcmorf vagy animáció. A nyitott
  élek egy része ruhaszegély lehet; számuk önmagában nem bizonyít hibát.
  Sziluettként használható referencia; animációs végleges alapként ELUTASÍTVA.
- A régi Titokváros renderindítás szerveroldalon letiltva még R2-foglalás és
  költségterhelés előtt. Státuszolvasás, meglévő videók és források megmaradnak.
- Studio aktív cél átvezetve Félixre és Maya–Unrealra; régi próbák külön archívumba
  kerültek a felületen. Sem régi forrás, sem modell vagy hang nem törlődött.
- `scene.json`: konkrét, hétbeállításos, 720 képkockás forgatási specifikáció,
  magyar mondatokkal és hangrendezéssel. Ez még nem 720 animált képkocka.
- Hivatalos mGear 5.3.5 csomag letöltve és SHA-ellenőrizve; Maya 2027 Linux
  solverfájlok jelen vannak. A kiadás új Anim Picker része preview: ez vizsgálati
  jelölt, nem elfogadott produkciós verzió. ueGear forrás is letöltve/pinnelve.
  Egyik bővítmény sem töltődött be Mayába/Unrealba.

## Hozzáférés és vásárlási lehetőség

Ebben a környezetben Ubuntu 24.04, kb. 10 GiB RAM, kb. 23 GiB szabad lemez és
nincs elérhető GPU; `maya`, `mayapy`, `UnrealEditor-Cmd` nem található. Autodesk
telepítő/licenc és Epic letöltési jogosultság nem elérhető a kapcsolatokon át.
Ez nem állítás arról, hogy a felhasználónak nincs ilyen licence.

| Tétel | Konkrét lehetőség | Döntés |
|---|---|---|
| Maya első érdemi próbái | Autodesk Flex: 33 token / 99 USD; Maya 6 token, kb. 18 USD / aktív 24 óra | 5 teljes Maya-nap és 3 maradó token. Vásárlás nincs; külön jóváhagyás kell. |
| Tartós Maya-előfizetés | Nyilvános USA lista: 255 USD/hó vagy 2010 USD/év | Nem javasolt első kísérletre. A havi első kifizetés is túllépi a 200 USD napi korlátot. |
| Maya Indie | Csak ország-, bevétel- és projektérték-feltételek teljesülésekor | Jogosultság és helyi ár nincs igazolva; nem automatikus választás. |
| mGear / ueGear | Ingyenes MIT keretrendszer | Nem kell új fizetős autorig-bővítmény. Maya- és engine-próbák még szükségesek. |
| Unreal Engine | Évi 1M USD alatti jogosult kisvállalkozásnak ingyenes; a filmes, küszöb feletti kategóriánál 1850 USD/fő/év | Cégjogosultságot és Epic-hozzáférést ellenőrizni kell; fizetős licencet nem aktiváltunk. |
| Városi épületek | Epic City Sample Buildings, ingyenes, UE-only | Jelölt. Saját Révszirt-elrendezéshez használható; nincs letöltve/beépítve. Az emberi crowd asseteket nem használjuk. |

Az árak 2026-10-11-i nyilvános USD tájékoztató adatok, helyi adó és pénztári ár
eltérhet. A 99 USD nem a teljes film vagy modellezés költsége. A 30 napos Maya
trial technikai értékelési lehetőség, nem automatikusan kereskedelmi filmlicenc.
A licenc önmagában nem készít professzionális karaktert: kézi topológia, bőrsúlyozás,
arcmimika, bunda, anyagok és animátori kidolgozás kell.

Működő következő környezet: aktivált Maya és Unreal ugyanazon elérhető, tartós GPU
munkaállomáson, vagy két elérhető gépen szabályozott fájlátadással. Kiinduló
kapacitásjavaslat (mérendő, nem szolgáltatói minimum): 64 GB RAM, 24 GB VRAM,
200 GB tartós lemez. A meglévő Blender serverless worker nem ilyen munkaállomás.
A korábbi RunPod GraphQL-hozzáférést Cloudflare blokkolta; nem kerültük meg.
Külön UE image / tartós munkakörnyezet hozzáférése szükséges azonos RunPod-fiókon
belül; a régi végpontot nem cseréljük le. Konkrét GPU-díj és kapacitás még nincs
lefoglalva. Mai adatbázis-foglalás 72 USD; új fizetős művelet 0.

## Mi kerül át és mi marad szerkesztési forrás

A teljes Maya rig és vezérlőháló Maya-forrás marad. A deformáló csontváz,
bőrözött háló, sütött animáció és blend shape-ek FBX-en mennek át. Az Unreal
Control Rig külön ellenőrzött rig; az összes Maya constraint átvihetősége nem
feltételezhető. A bundához XGen → Alembic Groom és kötési próba kell. Az Arnold
anyagok nem másolódnak teljes egészükben: PBR-textúrák és Unreal-anyagok külön
lookdev-próbát kapnak. Epic FBX importdokumentációja a 2020.2 SDK-t nevezi meg;
a tényleges export/import pluginverziókat és eredményt kell rögzíteni.

A ueGear forrás README-je FBX SDK-igényt, visszafelé számoló riggel és néhány
komponenssel kapcsolatos nyitott munkát is jelez. Nem kezeljük univerzális,
veszteségmentes átvitelként. Első körben a gyártói Shifter FBX Exporter és egy
egyszerű, ellenőrzött natív FBX-próba vethető össze.

## Ellenőrző eszközök — pontos futtatási státusz

`doctor.py` itt ténylegesen futott: `BLOCKED_MISSING_DCC`, 2-es kilépés. Nem indít
licencet fogyasztó alkalmazást. `maya_export_probe.py` és
`unreal_import_probe.py` csak szintaktikailag ellenőrzött adaptervázak, **nem
runtime-tesztelt integrációk**. Az `.uproject` projektváz, nem elkészült utca.

```bash
python3 production/titokvaros/professional/doctor.py --output /tmp/dcc_preflight.json
# Csak hozzáférhető, aktivált Maya és valódi, szerzői rigfájl esetén:
mayapy production/titokvaros/professional/maya_export_probe.py --scene /assets/FELIX_RIG.ma --output /exports/FX_EXCHANGE_V001
```

Az exporthoz `TV_EXPORT` objectSet kell, egy deformáló gyökérrel, bőrözött
hálókkal, tényleges UV-koordinátákkal, arcmorfokkal; cm és 24 fps. A próba nem
módosítja az eredeti Maya-fájlt. Unrealben az exportmappára mutató
`TV_EXCHANGE_DIR` változóval fut az importszkript, új hash-alapú célmappába.
Az importleltár még nem bizonyít méret-, póz-, morf-, bunda- vagy anyagazonosságot.

Első elfogadási csomag: 1 m-es méretjel, nyugalmi póz, 72 frame teljes testes
mozgás, szemhéj/jaw/szájformák, farok és fül, világos/sötét bunda-közeli. Mindkét
alkalmazásból tényleges kép és mérés; 24fps frame-egyezés; megnevezett sérülések.
Ezután futás, ugrás, kézkontaktus, végül a teljes 30s eredeti jelenet. Automatizált
import nem helyettesíti a mozgókép és teljes magyar hangkeverés jóváhagyását.

## Források

- Maya árak: https://www.autodesk.com/products/maya/overview
- Flex új minimum: https://adsknews.autodesk.com/en/news/autodesk-for-small-business-update-making-it-more-affordable-to-get-started-with-autodesk-flex/
- Flex díjak: https://www.autodesk.com/buying/flex/flex-rate-sheet
- Maya követelmények: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/System-Requirements-for-Autodesk-Maya-2027.html
- mGear: https://mgear-framework.com/ és https://github.com/mgear-dev/mgear/releases/tag/5.3.5
- ueGear: https://github.com/mgear-dev/ueGear és https://mgear4.readthedocs.io/en/stable/ueGearUserDocumentation.html
- Unreal licenc: https://www.unrealengine.com/license
- FBX: https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-material-pipeline-in-unreal-engine
- Groom: https://dev.epicgames.com/documentation/unreal-engine/xgen-guidelines-for-hair-creation-in-unreal-engine
- Városi csomag: https://www.fab.com/listings/008fe959-5511-428e-93bd-f99b1179f6d5

Másodlagos mocap-jelöltek: Rokoko Vision és mozgáskönyvtár; DeepMotion ingyenes
csomagja nem kereskedelmi használatú. AI mocap tényleges felvétel nincs. A külön
korábbi CMU-import kutatási adat volt, nem kész állatszínészi játék; a kapott
BVH-k nem tartalmaznak felvett ujj- vagy arcjátékot.
