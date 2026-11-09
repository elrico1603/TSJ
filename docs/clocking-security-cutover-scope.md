# Volgende veiligheidsgrens: gebruikersidentiteit en payroll

## Geïmplementeer en getoets — hervatting 2026-11-06

- `managementMigration.ts` en `firestoreMigrationPort.ts` voer nou 'n eksplisiete,
  weergawe-gebonde manifest uit. 'n Private checkpoint bevat gesaniteerde profiele,
  gesoute credential-digests en ou ID-verwysings voordat enige profiel verander.
  Hervatting hergebruik dit; dit lees nooit 'n blanke/nuwe openbare PIN terug as
  gesaghebbend nie. Bestaande beskermde gebruikers word nie oorskryf nie.
- Bronweergawes, nuwe gebruikers, individuele toelaes en UID-binding word
  gekontroleer. Die profiel en gekose toestemmingrekord word weer binne die
  projeksietransaksie nagegaan. 'n Gelyktydige PIN-wysiging bly behoue en toegang
  bly gesluit vir herstel. Die hele kohort se aanmelding bly gesluit tot voltooiing.
- Afsluiting verwyder slegs beoordeelde duplikaat-/ongebruikte aktiewe projeksies,
  behou hul gesaniteerde herstelrekords en gesoute digests in die private checkpoint,
  skryf veilige werknemer-/toestemming-/rolprojeksies en die commit-oudit atomies.
  Bestaande besigheidsgeskiedenis en ou ID-verwysings word nie stilweg herskryf nie.
  Die ou onbeveiligde bulk-apply-pad is gedeaktiveer; cohort-herstel kan nie met
  die los herstelopdrag bronkontroles omseil nie.
- Vars produksie-inspeksie: 17 profiele / 10 unieke e-posadresse. Die nuwe
  aanmelding wat intussen bygekom het, is ingesluit. Die konkrete plaaslike
  manifest `management-migration-46c22506c63816e6.json` is leesalleen teen die
  werklike profiele, toelaes en Auth-bindings gekontroleer: 8 aanmeldings word
  behou, 9 ou projeksies sou aftree, geen checkpoint/skrywes is gemaak nie.
  Dit is 'n kandidaat, nie goedkeuring of 'n uitgevoerde produksiemigrasie nie.
- Werklike browsertoets het 'n eerste-besoek/koue-offline-beginfout in `public/sw.js`
  blootgelê. Die werklike dienswerker cache nou kritieke JS/CSS voor die HTML;
  ontbrekende opsionele ikone breek nie die installasie nie, en 'n ontbrekende
  kritieke asset vervang nie die laaste volledige offline shell nie.
  IndexedDB-joernale word nie uitgevee of deur cache-opruiming verander nie.
  API/no-store/Authorization-versoeke word nie as offline sukses gecache nie.
- `netlify.toml` bevat nou die twee beperkte API-proxies voor die SPA-fallback.
  Cloud Run-URL is weer leesalleen bevestig; live revisie bly `00015-b5b`.
  Geen proxy, dienswerker of nuwe endpoint is gepubliseer nie; hekke bly AF.

Bewyse: 15 gerigte migrasie-/hervatkontroles en 19 bestaande bestuurstoetse slaag.
10 kontroles loop in 'n werklike, afsonderlike Chrome-profiel. Daarna slaag 14
gekoppelde browser/API/Auth/Firestore-emulatorkontroles op `demo-tsj-clock-test`:
werklike custom-token-enrollment en private roster, offline IN/OUT, kruis-tab-
sluiting, hele browser toe + webbediener af + koue offline begin op `/clocking-kiosk`,
IndexedDB-skryffout, hersteluitvoer, opsetlik verlore antwoord ná werklike
server-commit en herhaling van dieselfde IDs met presies een receipt per gebeurtenis.
Die emulatorproef gebruik die werklike roetes, migrasiestore, prototipe-verstekreëls
en dienswerker met kunsmatige data. Dit gebruik geen produksietoegang of betaalde
toetshulpbronne nie. Named-registry-kliëntreëls bly deur die vorige onafhanklike
gepubliseerde-reël/403-proef bewys; emulator se implisiete named-database-reëls
is nie 'n plaasvervanger vir daardie produksieverifikasie nie.

Die draagbare Java-runtime, emulatorcache, Chrome-toetsprofiele en private
manifeste bly binne `.local/` en buite Git. Geen Java-stelselinstallasie is gedoen
nie. `npm run test:clocking:emulators` begin en stop slegs plaaslike demo-dienste;
die emulatorconfig mag NIE vir `firebase deploy` gebruik word nie.

Voor live aktivering bly nodig: bevestig of Break/Return gebruik word (huidige
nuwe joernaal is IN/OUT), hersien die prototipe teen gebruikte besigheidsmodulepaaie
en identiteits-/historiese verwysings, oefen 'n werklike backup-herstel, en voltooi
die fabriektablet-aanvaarding. Daarna volg aparte goedkeuring vir reëls/migrasie,
merge/deployment en een beheerde kiosk. Moenie 'n ou snapshot gebruik ná nuwe
gebruikers/werknemers bygevoeg is nie; manifest-bronkontroles moet opnuut slaag.

Terugrol ná credential-migrasie mag NIE bloot die ou frontend/Cloud Run-revisie
`00015-b5b` en plaaslike passwordvergelyking herstel nie: dié weergawe verstaan nie
die beskermde aanmelding nie. Behou 'n versoenbare management/replay-backendrevisie
en frontend as die post-migrasie-terugrolpunt. Hou die nuwe veilige aanmeldpad,
credentials, receipts, private checkpoint en IndexedDB behoue; stop nuwe innames
onder toesig en versoen wag-IDs. Voor migrasie bly die ou vasgelegde revisie die
baseline. Moenie veilige hekke blindelings AF skakel ná die credential-oorskakeling
of die hele ou backup oor nuwe geldige data herstel nie.

## Opvolg 2026-11-06

Die eienaar het die verwydering van alle geargiveerde artisans uitdruklik
gemagtig. 17 canonical werknemerrekords met `isArchived == true` of
`status == Archived` is verwyder met updateTime-voorwaardes en een atomiese
commit; 8 aktiewe artisans is behou. Geen employeeViews of subcollections het
vir die gekose rekords bestaan nie. Ouditinskrywing en 'n plaaslike herstelkopie
onder die Git-uitgeslote `.local/` is gehou. Dit was 'n data-opruiming, nie
'n app-deployment of verandering aan bestuursgebruikers nie.

Vars leesalleen-gebruikersvergelyking: die 16 bestuursprofiele en 9 unieke
e-posadresse bestaan steeds. Oorvleuelende moduletoelaes is ekwivalent.
Die huidige app se profielkeuse stem vir die 7 gebruikte aanmeldings ooreen
met die bestaande ID-verwysings in toestemmingsrekords. Hou dié profiel-ID en
credentialbron in die voorstel; die ander ou PINs verskil by drie groepe.
Geen PIN is gewys, gestoor in die hersieningsverslag, gereset of gemigreer nie.
Die Frans-toestelverskil is eksplisiete skermblokkering in die nuwer
toestemmingrekord; die voorstel kies die nuwer beperkings, nie 'n unie van toegang nie.
Die eienaar meld dat Employee User en Purchasing User nie gebruik word nie;
die voorstel sluit hulle uit toekomstige aanmelding uit, maar geen live rekord
of toestemming is verander nie. Die plaaslike mensleesbare voorstel is
`.local/management-reconciliation-proposal.md`; dit is nie 'n uitgevoerde migrasie nie.

Die eerste goedgekeurde daaglikse backup is onafhanklik as READY bevestig:
`5ee7052e-e84c-48a1-9250-8720f62f272d`, snapshot 2026-11-05T15:26:41.156820Z,
verval 2026-11-12T15:26:41.156820Z. 'n Herstelproef is steeds uitstaande.
Die nuwe offline Clocking en veilige bestuursaanmelding bly AF en ongepubliseer.
Normale live inskrywings mag intussen voortgaan; enige latere migrasie moet sy
bron weer lees en nuwe werknemers/gebruikers insluit, nie die ou verslag as 'n
vaste produksiesnapshot uitvoer nie. Geen nuwe gebruiker of artisan is namens
die eienaar geskep tydens hierdie hersiening nie.

Status 2026-11-05: gebruiker het User Creation en gekoppelde aanmelding/
toestemmingskode uitdruklik ontsluit vir die toetsbranch. Die kandidaat hieronder
is geïmplementeer, met alle nuwe hekke standaard AF. Gepubliseerde verstekreëls,
lewendige gebruikers en die app-deployment is nie verander nie.

## Geïmplementeerde toetskandidaat

- Server-verifieerde bestuursaanmelding met 'n gebonde Firebase custom-identiteit,
  private gesoute scrypt-passwords, eksplisiete toestemmings en sessieweergawes.
  Rolname of plaaslike sessionUser kan geen server-toestemming verleen nie.
- Bestaande gebruikersvorms gebruik beskermde skep/goedkeur/wysig/deaktiveer-
  eindpunte. Geen password, hash of huidige PIN word na die blaaier teruggestuur
  nie; bestaande geldige credentials word eers by 'n beoordeelde migrasie gehash.
- Private gesaghebbende rekords in die bestaande named registry; gesaniteerde
  profiele en ACLs in die verstekdatabasis. 'n Mislukte kruisdatabasisverandering
  blokkeer toegang en behou die gesaghebbende rekord vir operator-herstel.
  `--repair-user=ID --inspect` ondersoek; `--apply` vereis aparte cutover-goedkeuring
  en die eksplisiete operator-omgewingsbevestiging. Dit herstel nooit vanaf 'n
  openbare/ou profiel nie. UID/email-verskille bly geblokkeer vir hersiening.
- Werknemer- en payroll-skrywers gebruik server-toestemming, 'n huidige
  clockRevision en 'n rede vir bywoningsregstellings; voor-/nawaardes word in
  dieselfde transaksie geouditeer. Payroll-harddelete is geblokkeer.
  IN/OUT-transaksies werk ook die PIN-vrye employeeViews-projeksie atomies by.
- Realm-gebonde RBAC-paaie voorkom dat toetsgebruikers gedeelde produksierolle
  verander. Roltemplates is metadata; individuele beskermde toelaes bly gesaghebbend.
- `config/firestore.management.prototype.rules` is 'n ONGEPUBLISEERDE PROTOTIPE.
  Dit is nie gereed om sonder verdere hersiening in produksie te gebruik nie.
  Volledige besigheidsveldschemas, bestaande modulepaaie en skermgedrag moet nog
  teen 'n geïsoleerde volledige app-omgewing bevestig word. Geen deploy-config
  teiken hierdie lêer nie.

## Bewyse en werklike migrasieblokkers

Een finale doelgerigte rondte: 80 basiese Clocking-, 15 produksie-Clocking-,
19 veilige bestuur-, 23 legacy-duplikaat- en 43 server-toestemmingstoetse slaag.
37 Rules REST-evaluasies met kunsmatige resources en alle diensleesfunksies
gemock slaag; geen ruleset/release of dokument is daarmee gepubliseer/verander nie.
Die ou duplikaattoets het net Firestore gemock en het twee Auth-netwerkfoute
gegee; sy secondary Auth word nou ook gemock. Al 23 slaag sonder regte Auth-skryfwerk.
Lint en build slaag; die bestaande Windows-ikoon- en bundelgroottewaarskuwings bly.

Leesalleen-inspeksie van produksie: 16 aktiewe profielrekords, 0 pending,
9 unieke e-posadresse, 7 ekstra rekords met herhaalde e-posadresse,
6 unieke e-poskandidate met meer as een bypassende toestemmingrekord.
Geen ontbrekende password/PIN-waardes onder die ondersoekte unieke profiele nie.
Hierdie tellings oorvleuel en moet nie bymekaargetel word as aparte gebruikers nie.
Geen rekord is gekies, saamgevoeg, uitgevee of gemigreer nie.
Die plaaslike `.local/management-migration-review.json` bevat slegs beoordeelbare
identiteits-/toestemmingvelde, geen credentials nie, en is van Git uitgesluit.

Volgende beperkte stap: vergelyk die duplikaatprofiele en individuele toelaes,
maak 'n eksplisiete keusemanifes met behoud van ou rekord-IDs en verwysings,
en oefen migrasie/herstel eers op geïsoleerde data. Die huidige migrasie stop
by enige duplikaat/oorvleueling of reeds bestaande beskermde rekord; dit kan dus
nie per ongeluk bestaande gesag vanaf openbare legacy-data oorskryf nie.
Een-record-herstel is geïmplementeer; 'n hervatbare volledige cutover-manifes
moet saam met die beoordeelde identiteitskeuses voltooi word vóór live uitvoering.
Geen PIN/wagwoord is in die verslag, Git of hierdie inspeksie-uitvoer gedruk nie.

Verder bly Netlify-live-instellings, tablet/offline/koue herbegin, break/return-
versoenbaarheid, eerste voltooide backup plus herstelproef, en die credential-
herstelbesluit vir histories openbare profiele deployment-hekke.
Alle aktiverings, main merge en app-deployment bly 'n aparte beoordeelde stap.

## Oorspronklike probleem en goedgekeurde omvang

## Waarom 'n losse reëllêer nie die probleem oplos nie

`src/App.tsx` gebruik tans `auth.signInAnonymously()` vir die hoof-Firebase-
sessie en lees `/artifacts/timbersmith-terminal-v1/private/users/active`
voor die bestuursaanmelding. `handleAuthSubmit` vertrou dan
`authManager.authenticateUser(activeUsers, emailInput, pinInput)` en stoor
die gekose gebruiker plaaslik. Die Firebase-identiteit word nie daarmee
na 'n server-verifieerbare bestuurder omgeskakel nie.

Daarom is `request.auth != null` onvoldoende: dit onderskei nie 'n bestuurder
van enige ander anonieme blaaier nie. 'n Kliëntrol of plaaslike sessionUser
mag ook nie server-toestemming verleen nie. Om bloot alle huidige reads/writes
te weier, sou die bestaande aanmeld- en bestuursvloei breek.

## Presiese raakpunte met die geslote gebruikersmodule

- `src/auth.ts:createUserByAdmin`: skep 'n Firebase email/password-gebruiker
  via 'n secondary app en skryf die aktiewe profiel direk na Firestore.
  Dit stoor tans ook die bestuurspassword/PIN in die profiel.
- `registerUserRequest` en `approveUser`: skryf pending/active-profiele en
  verwyder pending-rekords met die huidige kliëntsessie.
- `RolePermissionHub`: wysig profiel, rol, toesteltoegang, aktiveer/deaktiveer
  en PIN direk op dieselfde aktiewe profiele.
- `App.tsx`: skryf ook gebruikerwysigings en baseer moduletoegang op
  plaaslike gebruikersdata en toestemmings.

Nuwe reëls wat hierdie paaie werklik beveilig, raak dus die funksionele
kontrak van User Creation, selfs al bly sy vorm presies dieselfde.
Dié grens vereis uitdruklike ontsluiting voor implementering.

## Voorgestelde beperkte ontsluiting

1. Behou bestaande gebruikersvorms, geldige gebruikers/PINs, goedkeuring en
   rolkeuses. Geen nuwe besigheidsfunksies of ontwerpverandering nie.
2. Maak aanmelding server-verifieerbaar; bind die server-identiteit aan presies
   een goedgekeurde gebruiker. Geen kliënt-aangestuurde rol, UID of isAdmin
   mag as bewys aanvaar word nie. Hersien legacy-profiele se UID/email-
   bindings en duplikate voor enige migrasie; moenie name of PINs outomaties verander nie.
3. Migreer die minimum nodige gebruiker-/rolskrywers saam met die reëls,
   sodat die bestaande skep/goedkeur/wysig/deaktiveer-vloei aanhou werk.
   Geen selfverheffing, ongesaghebbende profielskrywes of openbare credential-reads nie.
4. Maak Clocking-ontvangsbewyse en ure server-beheerd; inventariseer ook
   Employee Editor, shift-regstellings, archive/delete en enige import.
   Hulle moet verwagte clockRevision en ouditbewyse respekteer sodat hulle
   nie getekende offline-strome kan oorloop nie.
5. Hergebruik die nuwe registry vir goedgekeurde toesteltoegang; moenie die
   named-registry-reëls of bestaande usernames/PINs stilweg versoep nie.

## Aanvaarding en deployment-hek

Bewys op geïsoleerde data: bestaande bestuurder meld aan; geldige gebruiker
word geskep en goedgekeur; dubbele/onbevoegde skepping en selfverheffing word
geweier; deaktivering blokkeer toegang; anonieme kliënte kan geen PINs, ure of
ontvangsbewyse lees/verander nie; normale IN/OUT en recovery bly korrek.

Daarna volg die regte tablet se offline/herbegin/timeout-toets en die eerste
voltooide rugsteun plus 'n hersteltoets. Merge, app-deployment en verandering
van gepubliseerde verstekreëls bly 'n aparte goedkeuring ná hersiening.

Histories openbare profiele kan reeds credentialwaardes blootgestel het.
Die omvang moet dus 'n beoordeelde credential-/sessieherstelbesluit insluit;
geen outomatiese password-reset of aftekening is tot dusver uitgevoer nie.
