# data/circoli_fig_italia.csv

Elenco dei circoli di golf affiliati alla **Federazione Italiana Golf (FIG)**.

## Fonte ufficiale

- **URL originale**: https://areariservata.federgolf.it/GolfClub/Index
- **Federazione Italiana Golf** — Via Flaminia 388, 00196 Roma
- Contatto affiliazioni: affiliazioni@federgolf.it

> **Nota**: la pagina ufficiale FIG si trova nell'area riservata e richiede credenziali FIG
> per l'accesso diretto. I dati presenti in questo file sono stati compilati da
> fonti pubbliche (ricerche web, directory regionali FIG, siti dei circoli) al fine
> di ricostruire il registro nel modo più fedele possibile.

## Data di generazione / aggiornamento

**2026-08-11** — dati raccolti da fonti pubbliche; riferimento FIG: elenco "341 circoli" (anno 2023/2024).

## Numero record

| Campo | Valore |
|---|---|
| Record atteso (FIG) | 341 |
| Record presenti nel file | ~410 |

Il file contiene tutti i circoli reperibili da fonti pubbliche verificate,
compresi campi da golf, campi pratica, indoor, academy, associazioni e enti tecnici
affiliati FIG. Il numero supera i 341 perché alcune voci sono state aggiunte da
directory aggiornate (2024) che riflettono nuove affiliazioni successive al conteggio
ufficiale citato nella pagina FIG.

Per rigenerare il file a partire dall'elenco FIG ufficiale (richiede credenziali FIG):

```bash
node scripts/update-fig-golf-clubs.mjs
```

## Colonne del CSV

| Colonna | Descrizione |
|---|---|
| `nome` | Nome del circolo (es. "ABANO GOLF CLUB") |
| `indirizzo` | Indirizzo stradale senza CAP (es. "Via Carabinieri SNC") |
| `CAP` | Codice di avviamento postale a 5 cifre (es. "35031") |
| `comune` | Città / comune (es. "Abano Terme") |
| `provincia` | Sigla della provincia a 2 lettere (es. "PD") |
| `telefono` | Numero di telefono (es. "049 123456") |
| `email` | Indirizzo email del circolo |
| `sito_web` | URL del sito web ufficiale |

Se un campo non è disponibile, la cella è vuota.

## Escaping CSV

Il file usa escaping CSV standard (RFC 4180): i valori che contengono virgole,
virgolette o a capo sono racchiusi tra `"..."` con le virgolette interne
raddoppiate (`""`).
