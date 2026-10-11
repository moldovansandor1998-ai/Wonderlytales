# Titokváros — archivált technológiavizsgálat

2026-10-11: a felhasználó Maya → Unreal elsődleges láncot és Félix 30 másodperces
jelenetét kérte. A Blender/Rokoko retarget-próba leállítva, nem javítandó tovább.
Az aktív dokumentáció a `../professional/README.md` fájlban van.
Tényleges korábbi eredmény: a Rokoko 1.4.3 betöltődik; élő kapcsolati függőségek
hiányoznak. A futásadat importja sikerült, de a retarget a `toe.L/R` hiányánál
megállt. Retargetelt animáció vagy FBX-roundtrip PASS nem készült.
Az `inspect_inputs.py` továbbra is kizárólag a beérkezett fájl ellenőrzése.

A V001–V006 karakterek és a procedurális mozgásgenerátor elutasított fejlesztési
anyagok. Megőrzendők, de nem ezek további csiszolása a gyártási irány.

Kiválasztásra váró út: eredeti, kézzel kidolgozott állatkarakterek Blenderben;
Rigify vagy jóváhagyott Auto-Rig Pro; bevált mozgásátvitel és animátori tisztázás;
Unreal IK Rig / Control Rig / Sequencer és Movie Render Queue. Saját animációs
motor nem készül. A kód ebben a mappában ellenőrzési és átviteli eszköz lehet.

Állapot: vizsgálat folyamatban. A helyi Blender 4.5.3 elérhető. Unreal Editor és
helyi GPU nincs; a meglévő RunPod végpont Blender-feladatokat fogad. Ez nem
bizonyítja, hogy Unreal fut rajta. Működő Unreal tesztet csak tényleges editoros
importtal és mozgóképpel szabad PASS-nak jelölni.

A projekt meglévő adatbázisa, tárhelye, szinkronja és renderelője megmarad.
