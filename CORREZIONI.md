# GolfP — correzioni del 12 agosto 2026

Tutte le modifiche sono state fatte con ancore testuali, mai tagliando per posizione,
e provate caricando `index.html` in jsdom con `fetch`, `matchMedia` e MapLibre simulati.

---

## 1. Dati che si perdevano o si mescolavano

**Circoli che sparivano dall'elenco.** `importaElenco()` fondeva due circoli quando i nomi
si somigliavano, senza nessun altro controllo. Così **Mirabell** (Alto Adige) finiva dentro
**Mirabella Golf Club** (Avellino), a 674 km, e spariva.

La correzione non usa solo la distanza, perché non funzionerebbe: i circoli che arrivano da
`SOLONOMI` non hanno indirizzo e stanno su un punto finto attorno al centro della loro
regione, quindi il conto dei chilometri direbbe "diversi" anche per *Fonti* e *Golf Club Le
Fonti*, che sono lo stesso posto. Ora decide **la regione**, che per entrambi è affidabile;
la distanza interviene solo quando tutte e due le posizioni sono vere.

Risultato: Mirabell torna in elenco (353 circoli), Fonti e Rovigolf restano correttamente
uniti ai loro gemelli. Nessun circolo perso.

**Otto circoli romani sullo stesso punto.** In `trovaEsistente()` c'era `if (d < 0.4) return c`:
il primo circolo entro 400 metri vinceva a prescindere dal nome. Con Archi di Claudio, Casal
Palocco, Fioranello, La Castelluccia, Parco di Roma, Talenti, Tevere Tirrenia e Tiber 23 tutti
fermi su 41.8928, 12.4837, ogni campo che OpenStreetMap trovava in centro a Roma veniva
assegnato al primo dell'elenco.

Provato con una risposta Overpass costruita apposta:

| | prima | dopo |
|---|---|---|
| campo "Sferracavallo Golf" a 25 m dal punto | assorbito da **Archi di Claudio**, che si prende le sue coordinate | entra come **circolo suo**, Archi di Claudio resta provvisorio |

Ora la scorciatoia dei 400 m vale solo quando il circolo candidato ha già una posizione vera.

**I giri legati al circolo per posizione.** `giriDi(id)` cercava `g.circolo.id === id`, ma
l'`id` è l'indice nell'array: basta una cancellazione o un'unificazione perché gli indici
scorrano e un giro finisca sotto il circolo sbagliato. Ora si aggancia al **nome**, che il
giro già salva accanto all'id, e l'id resta solo come riserva per i giri vecchi.

---

## 2. Cose scritte e mai collegate

**Il mirino ⌖.** `miraPosizione()` accendeva la nota, ma non esisteva nessun `MAP.on('click')`
che la raccogliesse, e `posizioneCorretta` era letto in tre punti e **scritto in nessuno**.
Premevi il pulsante, toccavi la mappa, non succedeva niente. Ora il tocco sposta il segnaposto,
scrive `posizioneCorretta` e blocca ogni import successivo.

**La mappa del singolo campo.** `openCampo()` chiamava `apriMappaCampo()`, ma l'HTML che generava
non conteneva `campo-map` né `campo-osm`: entrambe le funzioni uscivano alla prima riga. Erano
sessanta righe che disegnano fairway, green, bunker e laghetti sul satellite **e leggono i par
delle 18 buche da OpenStreetMap**, completamente inerti. Aggiunti i due contenitori.

**"Non è qui" non reggeva all'import OSM.** Escludeva il circolo da Nominatim ma non da Overpass,
che al giro dopo lo rimetteva dove avevi detto che non è. Ora lascia un segno che l'import rispetta.

---

## 3. Mappa che scattava sul telefono

`paint()` buttava via tutti i segnaposto e ne ricostruiva trecento a ogni ridisegno — a ogni
filtro, ogni dieci indirizzi cercati, dopo ogni import — e ogni bandierina portava con sé una
propria animazione SMIL sempre in moto. C'era anche un `.slice(0, 400)` che faceva sparire in
silenzio i circoli oltre il quattrocentesimo.

Ora: i segnaposto si riusano invece di essere ricreati, si disegna solo quello che sta nella
parte di mappa che stai guardando (con un margine del 25%), la bandiera sventola **solo su
quella scelta**, e il taglio a 400 non c'è più.

Tolta anche la sorgente GeoJSON `clubs`, creata vuota e mai usata da nessuno.

---

## 4. Conti sbagliati

| Dove | Prima | Dopo |
|---|---|---|
| Putt per giro | divideva per **tutti** i giri, anche quelli senza putt segnati: con i putt in 2 giri su 10 usciva cinque volte più basso | divide per i giri che hanno davvero i putt |
| Green in regolamentazione | `x.putt \|\| 2` — un putt a **zero** (imbucato da fuori green) contava come due, e faceva sparire il GIR proprio dalle buche giocate meglio | `x.putt ?? 2` |
| 9 buche | `stableford()` usava l'handicap **intero** mentre `netto()` lo dimezzava: i due numeri non tornavano fra loro | `colpiRicevuti()` usa `hcpEffettivo()` e distribuisce i colpi sulle 9 buche effettivamente giocate. Provato: 18 di gioco → 9 colpi distribuiti, esattamente quanti ne toglie `netto()` |
| `MESI` | mancavano **agosto e dicembre** | dodici mesi |

---

## 5. Dati finti

Questo era il punto più serio rispetto alla regola "l'app parte vuota".

**Un giro intero inventato.** Se la lettura della foto falliva, `leggiFoto()` chiamava
`datiEsempio()` e riempiva `G` con un giro completo — Barlassina, 9 agosto, partenze gialle,
CR 71.2, slope 133, handicap di gioco 17, index 14.2, colpi e putt di ogni buca, tre distanze
col driver — **pronto da salvare come se fosse tuo**. `datiEsempio()` è stata rimossa. Ora la
lettura fallita dice il motivo e non scrive niente.

**Distanze delle mazze inventate.** Stessa cosa in `saccaImport()`: Driver 211 m, Ferro 7 141 m…
con sotto il pulsante "Aggiorna la sacca" che le scriveva davvero. Rimosse.

**L'errore vero non arrivava mai.** `visione()` ignorava la risposta del server e più avanti
diceva "nessuna chiave" anche quando il problema era un altro (429, 413, `GEMINI_API_KEY` non
impostata su Vercel). Ora il motivo vero arriva fino al messaggio a schermo.

---

## 6. Sicurezza

**`api/leggi.js` era un proxy aperto.** Nessun controllo: chiunque trovasse
`golf-p.vercel.app/api/leggi` poteva far girare le proprie richieste a Gemini sul tuo conto.
Aggiunto il controllo di origine — passano solo le chiamate che arrivano dal sito. Il limite
sul corpo era 12 MB e non scattava mai (Vercel taglia a ~4,5): portato a 4 MB. E al posto del
corpo grezzo si inoltrano solo `contents` e `generationConfig`.

**Lo script FIG cancellava i propri dati.** `update-fig-golf-clubs.mjs` punta a
`areariservata.federgolf.it`, che richiede il login: il parser trova zero righe, stampa un
avviso e **scrive comunque il file**, azzerando i 409 record. Ora si ferma se legge meno di
300 record o meno del 90% di quelli già presenti, e accetta `FIG_HTML=percorso/file.html`
per lavorare su una copia salvata da un browser autenticato.

---

## 7. Pulizia

- rimossa la seconda definizione, identica, di `setStyle()` e `setKey()`
- rimosso il blocco `CONTATTI` duplicato dentro `applicaIndirizzi()`
- `applicaIndirizzi()` non salva più su disco a ogni avvio quando non è cambiato niente
- tolto il calcolo di `x`/`y` con `merc()`: residuo di una vecchia mappa SVG, mai letto da nessuno, e finiva in memoria locale e sul Drive
- l'import OSM non inventa più "18 buche, par 72" per i campi pratica

---

## Il CSV di copilot: da non innestare

`data/circoli_fig_italia.csv` non è collegato all'app e non è l'elenco FIG: il README ammette
che i dati sono "raccolti da fonti pubbliche". Incrociato con i tuoi `INDIRIZZI`
(Federgolf × ISTAT), sui **217 nomi in comune**:

- **54 comuni discordi** — Menaggio invece di Grandola ed Uniti, Torino invece di Poirino,
  Appiano Gentile invece di Carbonate, Biella invece di Cerrione, Montecatini invece di
  Monsummano
- **32 CAP discordi**
- **9 province discordi**, fra cui **San Donato: MI invece di AQ** (esattamente l'errore già
  scritto nella tua consegna) e due voci con **OT**, provincia abolita nel 2016
- **76 record duplicati** in 37 gruppi (Alta Badia ×3, La Pinetina ×3, Menaggio ×2 con l'ordine
  delle parole invertito)

Vale la regola che ti eri già dato: incrociare sempre con ISTAT e Federgolf, e scartare ciò
che non combacia. Questo elenco non lo supera.

---

## Rimane da fare

1. **Lanciare `node scripts/posizioni-osm.mjs`** (vedi sotto) e ripubblicare.
2. **Sostituire la chiave Gemini**, ancora passata in chat.
3. **Tarare la lettura delle foto** con scorecard vere: ora che i dati finti non ci sono più,
   quando fallisce lo dice, e si vede subito cosa non funziona.
4. **Verificare la veste su mobile** con degli screenshot: la resa grafica è l'unica cosa che
   jsdom non può controllare.
5. `applicaTestata()` aggancia ancora il circolo letto da una foto con il confronto per
   somiglianza, senza conferma. Lì non ci sono coordinate da confrontare, quindi va bene, ma
   se ti capita un giro finito sotto il circolo sbagliato è quello il punto da guardare.
