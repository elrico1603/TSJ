# Presiese infrastruktuurstap vir goedkeuring

## Registry ook goedgekeur en voltooi

Ná die registry-kostebespreking het die gebruiker uitdruklik gesê om voort te
gaan. Die databasis is geskep met delete protection en die named deny-all-release
is gepubliseer. Die gepubliseerde bron en werklike GET/PATCH-weierings is
onafhanklik bevestig. Die verstekrelease is onveranderd. Sien die latere
registry-bewyse in `clocking-live-observations-2026-11-05.json`.
Die oorspronklike onuitgevoerde status hieronder is histories; die
infrastruktuurstappe is nou uitgevoer. App-aktivering en verstekreëlmigrasie
is nog nie goedgekeur of gedoen nie.

## Opdatering: rugsteun goedgekeur en geskep

Die gebruiker het die daaglikse 7-dae-rugsteun uitdruklik goedgekeur.
Op 5 November 2026 om 13:12 SAST is skedule
`f8245075-0af0-4550-8dc3-61b872b8129e` vir `(default)` geskep en met 'n
opvolglys bevestig: daily recurrence, retention `604800s`.
Die eerste rugsteunkopie was nog nie in die daaropvolgende backup-lys nie;
'n hersteltoets is nog nie uitgevoer nie. Hierdie goedkeuring dek nie die
registry, verstekreëls, merge of app-deployment nie.

Onderstaande voorstel is die oorspronklike plan; slegs sy rugsteunskedule-stap
is nou uitgevoer.

Status: VOORBEREI, NIE UITGEVOER NIE. Projek `timbersmithapp`, 5 November 2026.
Billing is reeds aktief. Hierdie stap is apart van merge, app-deployment en
die oop verstekdatabasisreëls se migrasie.

## Voorgestelde veranderinge

1. Skep een daaglikse rugsteunskedule vir `(default)` met sewe dae bewaring.
   Geen bestaande skedule is gevind nie. Dit skep nie noodwendig onmiddellik
   'n rugsteun nie: bevestig die eerste voltooide kopie en 'n geïsoleerde
   hersteltoets vóór enige riskante datamigrasie. Geen aanspraak dat 'n
   ingestelde skedule reeds 'n bewese rugsteun of zero-loss-herstel bied nie.
2. Skep die leë named database `tsj-clock-registry`, Standard/Native in `nam5`,
   dieselfde ligging en uitgawe as die huidige databasis. Aktiveer delete
   protection op hierdie nuwe databasis. Geen employee/payroll-kopie of
   toestelregistrasie word daarmee geskep nie.
3. Publiseer en verifieer die bestaande deny-all-kliëntreëls slegs op die nuwe
   registry, via die toegewyde `firebase.clock-registry.json`. Die huidige
   `(default)`-reëls en alle bestaande app-vloeie word nie met dié stap verander nie.
   Geen kiosk mag provision word voordat die werklike named-registry release
   en 'n geweierde kliëntversoek onafhanklik bevestig is nie.

Die voorgestelde databasisligging is nie Suid-Afrika nie: dit volg die bestaande
`nam5`-databasis. Die huidige backend loop in `africa-south1`. Hierdie stap
migreer geen bestaande data tussen streke nie.

## Koste

Die bykomende databasis het geen tweede gratis kwota nie; sy lees/skryf/berging
word volgens gebruik gehef. Backup-berging en herstelbewerkings word ook gehef.
Geen betroubare randbedrag kan sonder databasisgrootte en werklike gebruik
gegee word nie. Hierdie voorstel verander nie billing-planne nie.

Bronne: https://firebase.google.com/docs/firestore/pricing en
https://firebase.google.com/docs/firestore/backups .

## Beplande opdragte ná goedkeuring

Verifieer eers weer die projek, databasislys en skedules; hergebruik bestaande
hulpbronne indien 'n ander operateur dit intussen geskep het.

```powershell
gcloud firestore backups schedules create --project=timbersmithapp --database='(default)' --recurrence=daily --retention=7d
gcloud firestore databases create --project=timbersmithapp --database=tsj-clock-registry --location=nam5 --edition=standard --type=firestore-native --delete-protection
npx --yes firebase-tools@latest deploy --config firebase.clock-registry.json --project timbersmithapp --only firestore:rules
```

Gaan vóór deployment na dat die config steeds net `tsj-clock-registry` bevat.
As die databasis of reëlpublikasie faal, stop provisioning; moenie na `(default)`
terugval nie. Hou nuwe registry leeg terwyl die daaropvolgende sekuriteits-
en geïsoleerde tablet-aanvaarding nog uitstaande is.

## Omkeerbaarheid en volgende hek

'n Skedule kan later gestaak word; reeds gemaakte rugsteune bly tot hul
bewaringstyd verstryk, tensy apart verwyder. Nuwe registry kan leeg bly; dit
het delete protection. Geen outomatiese verwydering word voorgestel nie.

Hierdie stap maak die publieke `(default)`-reëls nog nie veilig nie. Daardie
migrasie moet backend-verifieerbare toestemming en die bestaande payroll-,
PIN- en gebruikerskrywers saam hanteer. User Creation bly gesluit. Geen
produksie-Clocking-aktivering voordat dit opgelos en getoets is nie.
