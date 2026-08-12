# GolfP — posizioni dei campi

## Fonte dei dati

La gerarchia delle posizioni è questa:

1. **Indirizzo FIG** — fonte anagrafica primaria.
2. **Google Geocoding** — trasforma l'indirizzo in latitudine/longitudine.
3. **OpenStreetMap / Overpass** — controllo indipendente della posizione.
4. **Mirino ⌖** — verifica manuale definitiva.

Le vecchie coordinate Photon presenti nelle release precedenti non sono più una fonte
valida e non vengono più applicate automaticamente.

## 1. Geocodifica degli indirizzi FIG

Il repository contiene `data/circoli_fig_italia.csv`.

Impostare la variabile d'ambiente `GOOGLE_MAPS_KEY` e lanciare:

```bash
npm run geocode:fig
```

Lo script crea:

- `data/coordinate_fig.json` — risultati utilizzabili dall'app;
- `data/coordinate_fig_audit.csv` — audit completo di ogni indirizzo.

Regole:

- `ROOFTOP` senza `partial_match` → `AUTO_OK`;
- `RANGE_INTERPOLATED` → verificabile;
- `GEOMETRIC_CENTER`, `APPROXIMATE` o `partial_match` → da verificare;
- nessun risultato → `NON_TROVATO`.

L'app applica automaticamente **solo `AUTO_OK`**. Gli altri restano sul punto provvisorio
finché non vengono controllati.

## 2. Controllo indipendente OSM

Dopo la geocodifica:

```bash
npm run audit:osm
```

Lo script cerca i golf course su OpenStreetMap, li abbina ai circoli e crea:

`data/audit_osm.csv`

Non modifica `index.html` e non sposta mai automaticamente un campo.

Classificazione:

- `OK` — Google/FIG e OSM sono entro 500 m e Google è `AUTO_OK`;
- `CONTROLLO` — differenza entro 1,5 km;
- `SOSPETTO` — differenza superiore a 1,5 km;
- `OSM_NON_TROVATO` — nessun campo OSM associabile;
- `OSM_AMBIGUO` — più candidati possibili;
- `GOOGLE_NON_DISPONIBILE` — Google non ha prodotto coordinate.

## 3. Pubblicazione

Committare questi file:

- `index.html`
- `sw.js`
- `api/geocodifica.js`
- `data/circoli_fig_italia.csv`
- `data/coordinate_fig.json`
- `script/geocodifica-fig.mjs`
- `script/posizioni-osm.mjs`
- `package.json`

Non committare mai la chiave Google.

Su Vercel deve esistere la variabile:

`GOOGLE_MAPS_KEY`

La chiave resta soltanto sul server dentro `api/geocodifica.js`.

---

## r13 — perché le 165 posizioni sono tornate

r12 aveva svuotato `POSIZIONI` (165 coordinate da Photon/Nominatim) in attesa di
`data/coordinate_fig.json`. Ma finché quel file non esiste, quei 165 circoli
ricadono sul **centro del comune**. Prova eseguita in jsdom sui tre file:

| versione | posizionati | sul centro comune |
|---|---|---|
| r11 (prima) | 165 | 95 |
| r12 (svuotata) | 0 | **252** |
| r13 (questa) | 0 esatti, 165 provvisori | 95 |

La regola di r12 resta valida — Photon non è autorevole — ma la conclusione giusta
non è cancellare: è **declassare**. Ora le 165 entrano come punto provvisorio,
restano marcate "?" e in coda su "Da posizionare", e vengono sostituite senza
chiedere da Google/FIG o dal mirino. Un'approssimazione dichiarata batte un
errore certo.

## Le coordinate FIG si generano dal sito, non dal terminale

`script/geocodifica-fig.mjs` chiede una `GOOGLE_MAPS_KEY` sul portatile. Non serve:
l'app ha già lo stesso identico percorso dentro, con la chiave che resta su Vercel.

Pannello mappa → **"Risolvi con Google"**. Compone lo stesso indirizzo
(via + CAP + comune + Italia), chiama `/api/geocodifica`, applica la stessa
regola ROOFTOP, scarta i risultati oltre 25 km dal comune e salva.

Se risponde con un errore, vuol dire che manca `GOOGLE_MAPS_KEY` fra le variabili
del progetto su Vercel, o che la Geocoding API non è attiva sul progetto Google.
Lo script `.mjs` resta lì come strada alternativa, non come strada principale.
