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
├── sw.js                           ← ⬆ SOSTITUIRE (cache legata al numero di release)
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

**In sintesi: 4 file sostituiti, 2 nuovi, nessuna cartella nuova da creare.**
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

**1. Carica i file su GitHub, sul branch `main`.**

⚠️ È qui che si è inceppato finora. Nei deployment di Vercel gli ultimi caricamenti
risultano tutti sul branch `copilot/add-golf-clu…`, che genera solo **Preview**. L'ultimo
deployment marcato **Production** viene da `main` ed è vecchio: per questo il sito non
cambiava mai.

Su GitHub, quando carichi, controlla che in alto a sinistra il selettore del branch dica
**main**. Se hai una pull request aperta dal branch `copilot`, o la chiudi o la unisci —
ma non caricare più file lì dentro.

**2. Controlla che Vercel pubblichi `main`** e non il branch `copilot` (era il problema
del 12 agosto). Poi ricarica il sito con **Cmd+Shift+R**: il service worker tiene una copia
in cache e senza il ricaricamento forzato vedresti ancora la versione vecchia.

**3. Riconosci quale versione sta girando.** Da adesso c'è un numero di release.

Apri la console (Cmd+Alt+J) e la prima riga te lo dice da sola:

```
GolfP r2  ·  2026-08-12  ·  353 circoli
```

Per i dettagli, scrivi `GolfP` e invio:

```
release             2
data                2026-08-12
elencoVersione      2026-08-12-mirabell
posizioniVersione   null
circoli             353
senzaPosizioneEsatta 286
conVia              323
giri                0
drive               non collegato
azzera()            cancella l'archivio locale di questo browser e ricarica
```

Sul telefono, dove la console non c'è, il numero è in fondo alla colonna di sinistra,
sotto l'handicap index: **r2**.

**Se non vedi nessuna riga `GolfP r…` in console, stai girando la versione vecchia.**

Altri due segni immediati: nella versione giusta **non ci sono** i pulsanti
*Mappa / Terreno / Satellite* sopra la mappa (resta solo il satellite), e la scheda di un
circolo mostra la **mappa satellitare col tracciato del percorso**.

### Il numero va alzato a ogni consegna

`RELEASE` sta in due punti e devono restare uguali:

- `index.html`, in cima allo script: `const RELEASE = 2;`
- `sw.js`, in cima: `const RELEASE = 2;`

In `sw.js` il numero dà il nome alla cache (`golfp-r2`): alzandolo, la copia vecchia viene
buttata da sola all'attivazione e non serve più il Cmd+Shift+R a mano.

### Se il browser resta indietro

Da r2 l'app se ne accorge da sola e si riallinea. Se vuoi comunque ripartire pulito,
in console: `GolfP.azzera()` — cancella l'archivio locale, disiscrive il service worker,
svuota le cache e ricarica. I giri salvati sul Drive non si toccano.

---

## Perché golf-p.vercel.app mostrava 88 e l'altro indirizzo 358

Non era Vercel. `golf-p.vercel.app` e `golf-ggqcjx4er-….vercel.app` sono **lo stesso
deployment**, gli stessi identici file — si vede nella scheda del deployment, sotto *Domains*.

Ma **memoria locale, service worker e cache sono legati all'indirizzo**, non ai file.
`golf-ggqcjx4er-…` era un indirizzo mai visitato prima: nessun archivio salvato, nessun
service worker, l'app è partita pulita e ha importato tutto → 358.
Su `golf-p.vercel.app` c'era un archivio da 88 circoli con la marca dell'elenco già
scritta: `elencoAutomatico()` usciva subito e nessuno riallineava più niente.

Da r2 non può più succedere: oltre alla marca si guarda anche **quanti** circoli ci sono in
memoria, e se sono molto meno di quelli che il codice conosce si riallinea comunque, marca
o non marca. Provato col caso peggiore — 88 circoli in memoria **e** marca già identica a
quella del codice — e l'app risale lo stesso a 353.

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

**4-bis. Riporta in pari `golf-p.vercel.app`.** Una volta sola, poi non serve più.

Apri `golf-p.vercel.app`, console (Cmd+Alt+J), incolla e invio:

```js
localStorage.removeItem('golfp-v1');
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(c => caches.delete(c)));
setTimeout(() => location.reload(), 500);
```

In alternativa, senza scrivere niente: DevTools → **Application** → **Storage** →
**Clear site data**, poi ricarica.

Non perdi niente: `GIOCATI 0` e `GIRI 0`, non c'è nessun giro registrato in quel browser.
Se in futuro ne avrai, collega prima il Drive.

**5. Sostituisci la chiave Gemini** su Vercel (variabile `GEMINI_API_KEY`, Production +
Preview): quella attuale è passata in chat e in uno screenshot.

---

## Se qualcosa va storto

Si recupera sempre da:

```
https://raw.githubusercontent.com/jacopobergamin89-jpg/GolfP/main/index.html
```

che è l'ultima versione pubblicata.
