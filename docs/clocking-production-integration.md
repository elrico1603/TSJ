# Produksie-integrasie: besluit en uitvoerplan

## Registry-opstelling voltooi ná eienaargoedkeuring

`tsj-clock-registry` is op 5 November 2026 om 13:22 SAST as Standard/Native
in `nam5` geskep, met delete protection en sonder gratis kwota. Die bestaande
deny-all-bron is met die toegewyde config gepubliseer. Eksplisiete Rules API-
kontrole bevestig die named release en 'n presiese bronpassing; ongeverifieerde
GET en PATCH lewer 403 PERMISSION_DENIED. Die PATCH se exists=true-voorwaarde
op 'n willekeurige ontbrekende dokument kon geen rekord skep nie.

Die verstekrelease bly op sy vorige ruleset `b2a6c0d4-53c8-4926-8773-168cf2bfd5ec`.
Die algemene Firebase-reëluitleeshulpmiddel het ná deployment die named rules
teruggegee; dit was nie bewys van 'n verstekreëlverandering nie. Gebruik voortaan
`node scripts/verify-clock-registry.mjs --expect-default-ruleset=<independently-recorded-id>`
vir die presiese, leesalleen verifikasie. Geen terugrol van die verstekreëls was nodig nie.

Geen kiosk is nog geregistreer nie; geen payroll is verander en geen app-merge
of deployment is gedoen nie. Die oop verstekreëls en die huidige kliëntgebaseerde
bestuursaanmelding bly die volgende veiligheidsblokker. Die oorspronklike
User Creation-slot is steeds van toepassing; sien `clocking-security-cutover-scope.md`.

## Google Cloud-verifikasie voltooi (5 November)

Die Cloud Run-backend is bevestig as `ts-hub-backend` in `africa-south1`, met
100% verkeer na `ts-hub-backend-00015-b5b`. Die revisie se commit-label is
`5223dbb0e98ae6ad479d8df1f3bbab135288df72`; beeld-digest en diensrekening is
in die live-observations-lêer vasgelê. Dit vervang die vroeëre onbekende
backend-revisie en die nota oor ontbrekende gcloud-aanmelding.

Billing is reeds aktief. Suksesvolle lyste gee geen `(default)`-backupskedules
en geen Firestore-backups in `nam5` nie. Bestaande eksterne uitvoere is nog nie
uitgesluit nie. Die backend gebruik 'n Firebase Admin-diensrekening met breë
direkte projekrolle; die presiese regte moet voor aktivering tot die nodige
Clocking-bedrywighede beoordeel word sonder om ander backendfunksies te breek.

Die konkrete, nog-onuitgevoerde voorstel is in
`clocking-infrastructure-approval.md`: daaglikse sewe-dae-rugsteune en 'n leë,
beskermde named registry in `nam5`. Geen hulpbron, reël of live-app is hiermee
verander nie. Daardie bykomende gebruikskoste vereis eienaarstoestemming.

## Jongste live-verifikasie: 5 November 2026, ná heraanmelding

Firebase-aanmelding en toegang tot `timbersmithapp` werk weer. Gepubliseerde
verstekreëls is nou gelees: die rekursiewe `allow read, write: if true` laat
onaangemelde lees- en skryftoegang toe. Dit is 'n **kritieke**, bevestigde
aktiveringsblokker; 'n beskermde API alleen is onvoldoende.

Die suksesvolle databasislys bevat slegs `(default)`, Standard/Native, `nam5`.
`tsj-clock-registry` bestaan nie in dié lys nie. PITR en delete protection is
afgeskakel; hierdie metadata bewys nie dat daar geen aparte rugsteune is nie.
Cloud Run-revisie/IAM is nog onbevestig: die plaaslike gcloud het geen aktiewe
aangemelde rekening nie. Netlify se live-deploy bly ook onbevestig.

Bewys is in `clocking-live-observations-2026-11-05.json` vasgelê. Geen
werknemerdokumente of geheime is vir hierdie metadata-oudit afgelaai nie.
Geen live-reëls, databasis, billing of deployment is verander nie.
Onderstaande ou notas oor vervalde Firebase-credentials en onbekende
verstekreëls is deur hierdie verifikasie vervang. User Creation bly gesluit;
'n doelgerigte reëlmigrasie moet sy bestaande vloei eers in ag neem.

## Opdatering: 5 November 2026

Die gebruiker het die implementering van produksie-IN/OUT en Clocking-PIN op die
toetsbranch ontsluit. Die onderstaande oorspronklike oudit is die basislyn;
hierdie opdatering beskryf die nuwe kandidaat. Merge en deployment bly ongekeur.

Geïmplementeer:

- `/clocking-kiosk` laai 'n afsonderlike geregistreerde IN/OUT-vloei met die
  bestaande werknemerkaarte, vier-syfer PIN en IN/OUT-bevestiging. Dit laai nie
  die bestuursapp se anonieme Firestore-listeners nie. User Creation bly onaangeraak.
- `VITE_ENABLE_PRODUCTION_CLOCKING` is standaard af. Indien aangeskakel, stop
  die ou `processClockEvent` alle direkte Clocking-aksies en verwys na die
  geregistreerde terminaal. Break/return en spesiale Clocking-aksies is dus
  **nie beskikbaar wanneer hierdie vlag aan is nie**. Dit is 'n doelbewuste
  aktiveringsblokker totdat die eienaar die beperkte IN/OUT-omskakeling aanvaar
  of die bestaande break-vloei veilig geïntegreer is. Geen stil terugval nie.
- Die universele alternatiewe PINs is uit die bestaande persoonlike
  Clocking-verifikasie verwyder. 'n Werknemer wie se werklike toegekende PIN
  toevallig een van daardie waardes is, kan steeds sy eie PIN gebruik.
- Die ekstra supervisor-regstellingspaneel van die vorige branch is nou slegs
  op localhost beskikbaar; dit word nie as 'n nuwe live-funksie ingesluit nie.
- Die aparte produksie-IndexedDB behou getekende gebeurtenisse in invoegvolgorde.
  Web Locks serialiseer tabs. Die plaaslike transaksie gebruik streng durability;
  slegs voltooiing beteken "saved on device". Herbegin herlaai waglyste en alle
  werknemers se onafhanklike strome. Serverbevestiging en plaaslike basis-toestand
  word saam gestoor. Onseker antwoorde behou oorspronklike IDs.
- Die Admin-backend-roete is `/api/clocking/production/{bootstrap,replay}`.
  Dit vereis albei serverhekke in `.env.example`, 'n Firebase custom-token-kiosk,
  die beskermde registry-toestel, 'n werknemerbewys en die verwagte toestandweergawe.
  Die 8 KB request-limiet kom vóór die algemene 30 MB parser. Geverifieerde
  toestelkwotas word oor serverinstansies in die registry gedeel.
- Die server skryf werknemerure en die ontvangsbewys atomies. Duplikate word
  vóór tydvenster/toestandkontroles herken; infrastruktuurfoute breek die hele
  transaksie af. Konflikte en verwerpings word behou vir hersiening.
- Admin-provisioning lees slegs die bestaande werknemer-PIN; dit verander dit
  nie. 'n Willekeurige sleutel per werknemer/toestel word met AES-GCM versleutel
  onder PBKDF2-SHA256 (600 000 iterasies), gebind aan werknemer/toestel en 'n
  sewe-dae-geldigheidstyd. Die blaaier ontsluit dit met die bestaande PIN en
  teken elke gebeurtenis. Geen rou PIN, herbruikbare sleutel of token gaan in
  die joernaal, replay-payload of recovery-uitvoer nie. Plaaslike foutpogings
  word vóór verifikasie gestoor; vyf foute sluit vir vyf minute.

Bewese grens: vier-syfer PINs bly lae-entropie geheime. Enkripsie en UI-pogingbeheer
verhoed nie 'n aanvaller met 'n kopie van tabletberging om offline te raai nie.
Dit vereis 'n bestuurde, vertroude tablet, OS-/blaaierprofielbeskerming en 'n
uitdruklike eienaarbesluit vóór aktivering. Clienttye kan ook nie 'n betroubare
fisiese klokbron bewys nie. Toestelherroeping word by die volgende verbinding
afgedwing; 'n aflyn tablet kan nie onmiddellik van herroeping weet nie.

Nog blokkerend: Firebase se gekoppelde credentials het verval; projek-/reëltoegang
kon nie bevestig word nie. Geen gepubliseerde reëls, IAM, named database, Cloud Run
revisie, Netlify deploy, toestel, billing of rugsteun is verander nie. Die bronreëls
vir die registry bly deny-all, maar deployment is steeds onbevestig. Oop direkte
writes na produksie-ure sou die API-sekuriteit omseil; aktivering bly verbode
totdat die werklike verstekreëls en alle toegelate payroll-skrywers hersien is.

### Konkrete volgende uitvoer

1. Herstel Firebase-aanmelding as eienaar. Geen tokens of PINs in chat nie.
   Lees daarna gepubliseerde reëls, databasisuitgawe, IAM en werklike
   Cloud Run/Netlify revisies. Neem en toets 'n herstelbare rugsteun.
2. Voer die kandidaat eers teen 'n aparte staging Firebase-projek met slegs
   fiktiewe werknemers en dieselfde namespace-struktuur uit. Provisioning en
   backend moet uitdruklik na staging wys; die bronkode se verstek is live.
   Moenie sommer 'n fiktiewe werknemer in die live payroll skep nie.
3. Gebruik 'n presiese bevestigde HTTPS `VITE_CLOCK_API_ORIGIN` op Netlify.
   Dit vermy verandering van algemene Netlify-roetering. Indien same-origin
   verkies word, moet die beperkte proxy eers vóór die SPA-fallback bykom.
   Staging se presiese oorsprong moet ook in backend-CORS toegelaat word.
4. Admin-dry run: `npx tsx scripts/enroll-production-clock-device.ts
   --device=<device-id> --employees=<id1,id2>` doen geen Firebase-toegang nie.
   Eers ná afsonderlike goedkeuring, geverifieerde reëls/IAM/rugsteun en lokale
   `TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED=REVIEWED_RULES_IAM_BACKUP`, voeg `--issue`
   by. Die geheime custom token word slegs op die operateur se plaaslike terminal
   vertoon en net op die betrokke tablet se setup-skerm ingetik.
5. Vir 'n reeds goedgekeurde toestel gebruik dieselfde bevel met `--renew`
   in plaas van `--issue`, vóór sewe dae verstryk. Dit behou die UID en ou
   credentialgeskiedenis; hangende ou gebeurtenisse kan dus nog met hul
   oorspronklike bewys en IDs herhaal word. Geen outomatiese credentialrotasie nie.
6. Die herroepingsbevel is `npx tsx scripts/revoke-production-clock-device.ts
   --device=<device-id>` (dry run); `--revoke` vereis die operateurbevestiging.
   Dit sluit die registry eerste, dan die aparte Auth-identiteit. Bewyse bly behoue.
7. Recovery: `npx tsx scripts/recover-production-clock-journal.ts
   --file=<export.json>` valideer slegs plaaslik. Ná operateurbevestiging
   verwerk `--replay` die oorspronklike getekende IDs met die gewone transaksie;
   dit verander nie die invoerlêer nie en hou verwerpte strome terug.
   Herroepe toestelle vereis 'n aparte toesighouerbesluit; die hulpmiddel
   heraktiveer hulle nie outomaties nie. Voer die recovery-lêer uit vóór
   browserberging of toestelprofiel verander word.
8. Bewys op die regte tablet: IndexedDB-skryffout, vinnige dubbeltik/twee tabs,
   offline IN/OUT, koue offline-herbegin, vervalde credential, netwerkverlies
   ná server-commit, konflik en herstel vanaf 'n recovery-lêer. Die Node-toetse
   gebruik fiktiewe transaksies; hulle bewys nie hierdie browser-/live-eienskappe nie.
9. Hersien die konkrete diff, aanvaar die beperkte IN/OUT-omvang en kry aparte
   merge/deploy-toestemming. Die twee serverhekke bly af tot al die bewyse bestaan.

Kontroles: `npm run test:clocking:production`, bestaande `npm run test:clocking`,
`npm run lint`, `npm run build`. Die bestaande lock-lêer het afhanklikhede uit
`package.json` ontbreek; dit is versoen sonder nuwe pakketname in package.json.
Die Windows-prebuild kan steeds die bestaande ImageMagick/`convert`-waarskuwing
gee; bestaande ikone word behou. Dit is nie 'n Clocking-fout nie.

Vasgelegde plaaslike resultate op 5 November: 15 nuwe kandidaatkontroles slaag;
die bestaande 80 Clocking-kontroles slaag; finale lint en build slaag. Die HTTP-
kontrole gebruik slegs 'n tydelike loopback-server; geen toets het Firebase-data
gelees of geskryf nie. Toestel-enrollment en herroeping se dry runs slaag ook.
Geen werklike tablet-aanvaarding of gepubliseerde reëltoets is hiermee bewys nie.

## Oorspronklike basislyn (3 November; onderstaande bevindings is histories)

Oudit: 3 November 2026. Basis `6a28ca01d41f90b17cd55d831f205ae1d2db859c`;
vergelyk met plaaslik afgelaaide `origin/main` op
`5223dbb0e98ae6ad479d8df1f3bbab135288df72`. Geen bewys dat daardie main-commit
die tans ontplooide webwerf of Cloud Run-revisie is nie.

## Besluit

NIE gereed vir merge of deployment nie. Die toetsbranch bevat meer as die
offline sandbox. Geen nuwe verandering aan geslote User Creation, produksie
Clocking, PIN, reëls of deployment is met hierdie voorbereiding gemaak nie.

`node scripts/clocking-production-preflight.mjs` gee 'n leesalleen JSON-inventaris
met huidige bronverwysings. Uitgangskode 1 beteken die vrystelling bly geblokkeer;
2 beteken die inventaris kon nie voltooi nie. Dit lees geen credentials nie,
kontak geen diens nie en is nie 'n plaasvervanger vir live-verifikasie nie.

## Presies wat die kode vandag doen

| Deel | Bevinding en implikasie |
| --- | --- |
| Werklike Clocking | `src/App.tsx:processClockEvent` bereken vanaf die werknemer se kliëntkopie, vereis `isCloudLive`, en doen 'n direkte Firestore-transaksie. Geen duursame offline-gebeurtenis word in die produksietak geskep nie. |
| Verskil teen main | Die branch het reeds die suksesboodskap na die transaksie geskuif, toestandkontroles bygevoeg en offline-pogings laat faal. Dit verander produksiegedrag en moet uitdruklik hersien word voor merge. |
| Persoonlike PIN | `validateAndProcessPersonalPin` toets `personalCode`, dan `pin`, dan `clockPin`; produksie aanvaar ook drie vaste alternatiewe. Die vier-syfer skerm bly die werknemer se interaksie. |
| Toesighouer | `submitSupervisorPin` vertrou kliëntgebruikers/toestemmings en 'n superuser-PIN; dit is nie bewys van server-toestemming nie. |
| User Creation | Geen verskil teen main in `src/auth.ts`, `RolePermissionHub.tsx` of `EnrollmentModal.tsx` nie. Hou gesluit. |
| Ekstra branch-omvang | `SupervisorShiftReview` is op die admin-dashboard gekoppel, ook buite localhost, en kan op die produksiegasheer skryf. Dit is nie nodig vir die minimum offline-omskakeling nie; sluit dit uit die uiteindelike vrystelling tensy afsonderlik goedgekeur. |
| Joernaal | IndexedDB hou onveranderlike IDs en oorspronklike tye; sync bevestig net dieselfde ID, behou onseker pogings en is per werknemer/toestel afgebaken. Dit word nog nie vir produksie gebruik nie. |
| Toetsserver | `/api/clocking/test-replay` vereis 'n aparte geregistreerde kiosk-identiteit. Die roete is af op production/Cloud Run/Netlify; processor en registrasie aanvaar slegs toetsnamespaces. Moenie hierdie veiligheidshekke verwyder om live te gaan nie. |
| Netlify | `netlify.toml` publiseer `dist` en het slegs 'n SPA-fallback. Die geboude Express-server word nie daardeur bestuur nie. Die relatiewe toets-API-pad bereik dus nie Cloud Run deur hierdie konfigurasie nie. |
| Firebase | Frontend en Admin verstek na `timbersmithapp`. `APP_ID_PATH` is hardgekodeer na `timbersmith-terminal-v1`; 'n omgewingsveranderlike alleen is nie toetsisolasie nie. Die app gebruik anonieme Firebase Auth. |
| Reëls | Slegs die aparte registry se deny-all-bronreëls is in die repo. Die bestaande dokumentasie waarsku oor permissiewe verstekreëls, maar die gepubliseerde reëls is nie in hierdie oudit bevestig nie. |
| Herbegin sonder internet | Service worker cache die shell, maar geen volledige werknemer/PIN-bootstrap vir 'n koue offline-herbegin is bewys nie. Die tests bewys nie tabletduursaamheid nie. |

## Kortste veilige pad, in volgorde

1. Kry beperkte ontsluiting vir normale produksie-IN/OUT en Clocking-PIN-verifikasie
   op die toetsbranch. Behou bestaande vier-syfer skerms en geldige werknemer-PINs.
   User Creation en bestuursaanmelding bly gesluit. Merge/deploy is aparte besluite.
2. Lees die werklike Netlify deploy-ID/commit en Cloud Run-projek, diens, streek,
   revisie, verkeer en diensrekening. Die Gmail-kliënt verwys na
   `ts-hub-backend-859189362556.africa-south1.run.app`; dit bewys nie dat die
   revisie die huidige repo gebruik of teen dieselfde Firebase-projek loop nie.
   Lees gepubliseerde verstekreëls, registry-bestaan/reëls en IAM. Neem geen
   registrasie of betaalde databasis as reeds opgestel aan nie.
3. Neem en verifieer 'n herstelbare rugsteun van werknemer- en uredata, reëls en
   vrystellingsinstellings. Indien die aparte registry nog geskep moet word,
   kry eers eienaarstoestemming vir daardie infrastruktuur/koste.
4. Implementeer 'n aparte produksieroete met server-verifieerde kioskregistrasie,
   klein payload-limiet, tariefbeheer, vaste namespace en beperkte werknemers.
   Behou toetsroetes en hul hekke. Skryf ure en onveranderlike ontvangsbewys in
   een transaksie. Gaan bestaande ontvangsbewyse veilig na sodat 'n ou,
   reeds-verwerkte gebeurtenis nie bloot weens ouderdom as nuut verwerp word nie.
5. Beveilig die PIN-vloei binne die goedgekeurde omvang: geen universele
   alternatief nie; geen rou PINs in joernaal/API-gebeurtenisse/logs nie.
   Ontwerp toestelgebonde offline-verifikasie met plaaslike pogingbeperking,
   veilige provisioning en 'n uitdruklike geldigheidstyd vir offline-toegang.
   'n Vier-syfer hash alleen is nie sterk beskerming teen offline-raaiwerk nie.
   Kiosk-auth bewys toesteltoegang, nie dat 'n werknemer sy PIN ingetik het nie.
6. Sluit direkte onbevoegde writes na produksie-ure/ontvangsbewyse af met
   doelgerigte reëls en server-toestemming. Ouditeer alle bestaande skrywers
   (Clocking, HR-wysigings, toesighouerregstellings, imports) voordat velde
   gesluit word. 'n Beskermde API met oop direkte writes is onvoldoende.
   Indien dit geslote User Creation raak, stop daardie afhanklike verandering
   vir aparte ontsluiting; moenie stilweg omseil nie.
7. Koppel normale IN/OUT aan die joernaal: bevestig plaaslike transaksie VOOR
   sukses; projekteer toestand uit basis plus waggebeurtenisse; voorkom dubbele
   tikke oor tabs; sync alle toegelate werknemerstrome ook ná herbegin.
   Geen terugval na ou direkte writes ná 'n API-fout nie. Maak toestandkonflikte
   tussen toestelle sigbaar en behou die oorspronklike gebeurtenis vir hersiening.
   Break/return/special actions mag nie 'n wag-IN/OUT-stroom oorsteek nie:
   behou hul bestaande gedrag waar veilig, anders blokkeer met duidelike status
   totdat die betrokke stroom bevestig is. Geen nuwe break-funksie in dié omskakeling.
8. Kies een API-pad: 'n beperkte Netlify `/api/clocking/*` proxy VOOR die
   SPA-fallback na die bevestigde backend, of 'n presiese backend-URL met
   korrekte CORS. Gebruik 'n aparte toetsbackend/namespace vir preview;
   moenie die localhost-toetsroete in produksie oopmaak nie.
9. Een doelgerigte aanvaardingsrondte op geïsoleerde data: bestaande PIN;
   verkeerde/alternatiewe PIN; offline IN/OUT; browser-herbegin; koue offline
   begin; netwerkherstel; timeout ná server-commit; dieselfde ID-herhaling;
   plaaslike skryffout; toestelherroeping; konflik met tweede toestel;
   break/return met hangende gebeurtenisse. Kontroleer presiese ure én
   ontvangsbewyse. Voeg net regressietoetse vir die werklike veranderinge by;
   voer lint/build en die betrokke suite een keer ná finale kode uit.
10. Kry toestemming vir merge en deploy van die konkrete getoetste diff.
    Ontplooi backend eerste met nuwe toegang af; verifieer; aktiveer een
    goedgekeurde kiosk en versoen sy ure/joernaal voordat uitbreiding plaasvind.

## Terugrol sonder om waggebeurtenisse weg te gooi

- Teken vooraf die werkende Netlify deploy-ID en Cloud Run-revisie/traffic aan.
  'n Git-commit alleen rol nie die twee dienste of Firestore-reëls terug nie.
- Stop nuwe innames op die betrokke kiosk by 'n fout; voer die joernaal uit
  voordat cache/profiel/toestel verander word. Behou IndexedDB, toestel-ID,
  gebeurtenis-IDs, registry en server-ontvangsbewyse. Moenie app-data uitvee nie.
- Versoen elke hangende ID teen server-ontvangsbewyse. Herhaal met dieselfde ID;
  moenie 'n nuwe klokrekord met 'n nuwe ID skep om 'n timeout te probeer herstel nie.
- Rol frontend/backend na die vasgelegde versoenbare weergawes terug. Behou
  'n versoenbare replay/herstelpad vir bestaande joernale. Die ou frontend kan
  nie vanself die nuwe waglys verwerk nie; hou daardie kiosk gestop totdat die
  waglys afgehandel of onder toesig herstel is.
- Herstel reëls slegs na hersiening; moenie outomaties ou permissiewe writes
  heropen nie. Moenie die hele databasis oor nuwe geldige ure terugskryf nie.
  Maak enige nodige datakorreksies doelgerig met ouditbewyse.

"Zero data loss" is die ontwerpeis, nie 'n reeds-beweese waarborg nie. 'n Tablet
wat offline verlore raak of waarvan browserberging uitgevee word vóór enige
kopie/sync, het geen tweede kopie in die huidige ontwerp nie. Operasionele
joernaalrugsteun en 'n bewese herstelroete moet deel van aanvaarding wees.
