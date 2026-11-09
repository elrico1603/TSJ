# Registry-kosteskatter: 5 November 2026

Google Cloud Billing Catalog, Cloud Firestore Standard, North America 5 (`nam5`):

| Item | Geverifieerde ZAR-tarief |
| --- | --- |
| Read Ops | R0.000010005 per lees = R1.0005 per 100 000 |
| Entity Writes | R0.000030016 per skryf = R3.0016 per 100 000 |
| Storage | R3.001607999 per GiB-maand |

Pryse is via die geverifieerde operateur se leesalleen Billing Catalog API
met `currencyCode=ZAR` opgehaal. Effektiewe tyd `2026-11-05T08:00:00Z`.
Read SKU `369B-DC02-4DAB`; Write SKU `0FD8-FD9E-2D84`.
Bron: https://cloud.google.com/firestore/pricing en
https://cloud.google.com/billing/v1/how-tos/catalog-api .
Daar is geen vaste skeppingsfooi nie en geen gratis kwota vir hierdie tweede
databasis nie. 'n Leë databasis het geen app-dokumente of app-operasies nie.

## Kandidaat se versoekpatroon en voorbeeld

Die hele rooster word nou by startup, netwerkherstel, handmatige kontrole en
normaalweg elke 15 minute herlaai. 'n Mislukte roosterherlaai kry minstens
een minuut wagtyd voor die gewone timer weer probeer. Pending gebeurtenisse
probeer steeds elke 15 sekondes en onmiddellik ná plaaslike stoor sinchroniseer.
As daar geen pending gebeurtenisse is nie, doen daardie sync geen replay-API-call nie.

Een bootstrap gebruik normaalweg `(werknemers + 2)` registry-reads en een
registry-quota-write. Elke replay gebruik normaalweg drie registry-reads en
een registry-quota-write. Transaksieherhalings, ekstra tabs, herbeginne,
handmatige kontroles, retries en credentialsvernuwing kan dit verhoog.

Voorbeeld, NIE gemete werknemersgetal nie: 50 werknemers, een tablet,
10 uur per dag, 22 dae per maand, een IN en een OUT per werknemer per dag:

- Sowat 880 roosterherlaaie: 45 760 reads en 880 writes.
- 2 200 klokgebeurtenisse: 6 600 reads en 2 200 writes.
- Totaal: 52 360 reads = R0.5238618; 3 080 writes = R0.09244928.
- 10 MiB registry-berging as ruim rekenvoorbeeld: ongeveer R0.0293/maand.
- Registry-subtotaal: ongeveer **R0.65/maand**, vóór belasting, netwerk,
  retries en bykomende gebruik. Dit is nie 'n vaste kosteplafon nie.

Die voorbeeld sluit nie Cloud Run, netwerk, die bestaande payroll-databasis,
backup-berging of ander Google Cloud-dienste in nie. Veral die bootstrap lees
ook elke werknemer uit die verstekdatabasis; dié operasies gebruik sy eie
gratis kwota saam met die res van die app. Ware totale koste vereis
werksure, werknemersgetal en gemete gebruik ná geïsoleerde aanvaarding.

Geen registry is met hierdie kostekontrole geskep nie. Geen ekstra billing-
hulpbron, begrotingswaarskuwing of deployment is geaktiveer nie.
