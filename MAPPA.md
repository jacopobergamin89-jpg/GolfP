# GolfP — mappa del progetto e istruzioni di caricamento

Questo pacchetto contiene **solo i file cambiati**. Tutto il resto del repository
resta com'è: non toccarlo, non cancellarlo.

---

## Dove va ogni file

Scompatta e ricopia rispettando le cartelle. La struttura completa del repository,
dopo il caricamento, è questa:

```
GolfP/                              ← la radice del repository
│
├── index.html                      ← ⬆ SOSTITUIRE (tutta l'app)
├── CORREZIONI.md                   ← ⬆ NUOVO (documentazione, non serve all'app)
│
├── sw.js                           ← invariato, lasciare com'è
├── package.json                    ← invariato, lasciare com'è
├── manifest.webmanifest            ← invariato, lasciare com'è
├── icon-192.png                    ← invariato, lasciare com'è
├── icon-512.png                    ← invariato, lasciare com'è
│
├── api/
│   └── leggi.js                    ← ⬆ SOSTITUIRE (funzione Vercel, proxy Gemini)
│
├── scripts/
│   ├── posizioni-osm.mjs           ← ⬆ NUOVO (si lancia a mano dal computer)
│   └── update-fig-golf-clubs.mjs   ← ⬆ SOSTITUIRE
│
└── data/
    ├── circoli_fig_italia.csv      ← invariato (e da NON innestare nell'app, vedi CORREZIONI.md)
    └── README.md                   ← invariato
```

**In sintesi: 3 file sostituiti, 2 nuovi, nessuna cartella nuova da creare.**
`api/` e `scripts/` esistono già.

---

## Cosa fa ognuno

| File | Cosa fa | Gira dove |
|---|---|---|
| `index.html` | Tutta l'app: schermate, mappa, giri, sacca, statistiche | Nel browser |
| `api/leggi.js` | Riceve la foto dal browser e la gira a Gemini aggiungendo la chiave, che resta sul server | Su Vercel, a ogni lettura di scorecard |
| `scripts/posizioni-osm.mjs` | Risolve le posizioni e le vie una volta sola e le scrive dentro `index.html` | **Sul tuo computer**, a mano, quando vuoi |
| `scripts/update-fig-golf-clubs.mjs` | Rigenera `data/circoli_fig_italia.csv` dalla pagina FIG | Sul tuo computer, a mano |
| `sw.js` | Tiene una copia dell'app per quando manca la rete | Nel browser |

I due file in `scripts/` **non vengono mai eseguiti dal sito**: stanno nel repository
solo per averli sottomano. Vercel li ignora.

---

## Ordine delle operazioni

**1. Carica i file su GitHub**, nelle cartelle indicate qui sopra, sul branch `main`.

**2. Controlla che Vercel pubblichi `main`** e non il branch `copilot` (era il problema
del 12 agosto). Poi ricarica il sito con **Cmd+Shift+R**: il service worker tiene una copia
in cache e senza il ricaricamento forzato vedresti ancora la versione vecchia.

**3. Riconosci se è online la versione giusta**: apri un circolo qualsiasi e guarda se sotto
il titolo compare **la mappa satellitare col tracciato del percorso**. Se non c'è, è ancora
online la vecchia.

**4. Quando vuoi le vie esatte**, sul tuo computer, dalla cartella del repository:

```bash
node scripts/posizioni-osm.mjs --prova     # stampa e basta, non tocca niente
node scripts/posizioni-osm.mjs             # scrive dentro index.html
```

Poi ricarica `index.html` su GitHub. Ci mette una ventina di secondi e serve solo la rete,
niente da installare.

⚠️ Lo script riscrive **solo** la parte fra questi due segnalibri dentro `index.html`:

```js
/* <<< POSIZIONI-INIZIO --- ... */
const POSIZIONI_VERSIONE = ...
const POSIZIONI = { ... };
/* POSIZIONI-FINE >>> */
```

Non toccare quel blocco a mano. E se un giorno lo modifichi lo stesso, **cambia anche la
marca** `POSIZIONI_VERSIONE`: altrimenti l'app crede di averla già applicata e non riallinea
niente. È lo stesso errore che ha prodotto il disallineamento dell'11 agosto con
`ELENCO_VERSIONE`.

**5. Sostituisci la chiave Gemini** su Vercel (variabile `GEMINI_API_KEY`, Production +
Preview): quella attuale è passata in chat e in uno screenshot.

---

## Se qualcosa va storto

Si recupera sempre da:

```
https://raw.githubusercontent.com/jacopobergamin89-jpg/GolfP/main/index.html
```

che è l'ultima versione pubblicata.
