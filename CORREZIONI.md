# GolfP r8 — pacchetto unico, 12 agosto 2026

Questo documento copre tutto quello che è passato **da r1 a r6**. Le versioni intermedie non
sono mai state pubblicate: il file `index.html` di questo pacchetto le contiene tutte.

| | |
|---|---|
| r1 | correzioni ai dati, mirino, mappa percorso, conti, dati finti, sicurezza |
| r2 | riallineamento automatico dell'elenco |
| r3 | import OpenStreetMap paziente |
| r4 | scelta del circolo con ricerca |
| r5 | solo vista satellite |
| r6 | una sola veste chiara |
| r7 | secondo archivio per gli indirizzi, ricerca fino in fondo, diagnosi |
| r8 | specchi Overpass provati e sfoltiti, ricerca indirizzi come strada principale |


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

## r4 — la scelta del circolo

Il circolo si sceglieva da un `<select>` con **353 voci**, in tre punti diversi: Nuovo giro
(che era già stato risolto con un campo di ricerca), **Circolo di appartenenza** e
**Prossimo circolo da giocare** nel Profilo, rimasti tendine. Col dito sono ingestibili:
si scorre alla cieca e non si può cercare.

Ora tutti e tre usano lo stesso componente — scritto una volta sola, non tre — e si cerca
per **nome, comune o regione**:

| scrivi | trovi |
|---|---|
| `barlas` | Barlassina Country Club |
| `lentate` | Barlassina Country Club *(il comune)* |
| `sardegna` | Botanic Sa Cuba, Florinas… *(la regione)* |

Dettagli che contano:

- **Circolo di appartenenza** propone per primi quelli dove hai già giocato, e ammette
  «— nessuno —».
- **Prossimo da giocare** mostra **solo** i circoli ancora da giocare: cercare uno già
  giocato non restituisce niente, che è il comportamento giusto.
- Un campo lasciato scritto a metà **non** viene salvato come scelta: togliendo il fuoco
  torna al circolo selezionato. Serviva perché ora il campo contiene il *nome*, mentre il
  dato salvato è l'*id* — e `salvaCampiProfilo()`, che legge i campi in blocco, avrebbe
  scritto «Barlassina Country Club» dentro un campo che deve contenere un numero. I due
  campi sono stati tolti da quella lettura e li salva la tendina nel momento della scelta.

## r5 — solo satellite

I pulsanti *Mappa / Terreno / Satellite* erano già nascosti (`#m-style[hidden]`) e restava
un solo stile, ma il gruppo e la funzione `setStyle()` stavano ancora nel file: bastava
togliere un attributo perché tornassero. Ora sono spariti del tutto — markup, funzione,
variabile `STYLE` e oggetto `STILI`.

**E c'era un difetto nascosto sotto.** Il ripiego per quando MapTiler non risponde era
scritto così:

```js
if (STYLE === 'sat') return;
STYLE = 'sat'; setStyle('sat');
```

Ma `STYLE` valeva **sempre** `'sat'`, quindi la funzione usciva sempre alla prima riga e il
ripiego non scattava mai. Con la chiave MapTiler scaduta o la quota esaurita, la mappa
sarebbe rimasta nera per sempre senza dire niente.

Ora se MapTiler risponde 403, 404 o 429 si passa al satellite di **Esri World Imagery**: la
vista resta identica, cambia solo chi manda i riquadri. Provato simulando un 403:

| | pulsanti stile | dopo un 403 di MapTiler |
|---|---|---|
| prima | 1 (nascosto) | **nessun ripiego — mappa nera** |
| r5 | 0 | Esri satellite |

Vale anche per la mappa del percorso nella scheda del circolo.

## r6 — una veste sola

Tolti i temi **Carta** e **Notte** e la sezione *Aspetto* dal Profilo. Resta la vista chiara.

**Ma non era solo togliere due pulsanti.** I colori stavano in due posti che si
contraddicevano:

```css
:root                     { --fair:#00B85C; --flag:#FF6A3D; --paper:#EEF2ED; … }
body[data-tema="chiaro"]  { --fair:#0F7B52; --flag:#C7443A; --paper:#F1F3F0; … }
```

`body[data-tema="chiaro"]` ha specificità 0,1,1 contro 0,1,0 di `:root`: vinceva lui su
**undici** variabili. La tavolozza che vedevi non era quella scritta in `:root`.

Cancellare il blocco avrebbe cambiato i colori dell'app senza che tu l'avessi chiesto —
verde brillante al posto del verde scuro, corallo al posto del rosso. Quindi i valori
vincenti sono stati **spostati dentro `:root`**, e il blocco tolto. Confrontate tutte e
sedici le variabili prima e dopo: **nessuna differenza**.

**E un archivio salvato con il tema Notte non lo rimette più.** Sia la memoria locale sia il
ripristino dal Drive contenevano `tema: 'notte'` e lo riapplicavano all'avvio: senza questa
correzione, un dispositivo che aveva scelto Notte sarebbe rimasto scuro per sempre in
un'app che ha un tema solo, senza alcun modo di tornare indietro.

| archivio con `tema:'notte'` | risultato |
|---|---|
| r5 | `--paper: #08211A` — scuro |
| r6 | `--paper: #F1F3F0` — chiaro |

## r7 — gli indirizzi che non si trovavano

La ricerca aveva **una strada sola**: Nominatim. Prima con via, CAP e comune; poi, se
falliva, col nome del circolo. Sempre lo stesso server. Se Nominatim rispondeva a vuoto —
cosa normale, perché le vie di campagna spesso non sono nei suoi archivi mentre il campo da
golf sì — il circolo veniva marcato `geoVuoto` e **non lo cercava più nessuno**.

Ora le strade sono **quattro**, su **due archivi indipendenti**:

1. **Photon** (Komoot), filtrato sui soli `leisure:golf_course` — la più precisa
2. Nominatim, indirizzo campo per campo
3. Photon a testo libero — prende anche i circoli non marcati come campo da golf
4. Nominatim per nome — ultima spiaggia

Photon lavora sugli stessi dati OpenStreetMap ma con un server diverso e senza il limite di
una richiesta al secondo, quindi sta in prima battuta: è più veloce e regge di più.

Provato simulando esattamente la tua situazione — Nominatim che risponde ma non trova nulla:

| | Nominatim | Photon | posizionati |
|---|---|---|---|
| r6 | 50 richieste | — | **0 su 25**, e 25 marcati «non trovato» per sempre |
| r7 | 0 | 25 | **25 su 25** |
| r7, con anche Photon giù | 50 | 50 | 0 — ma è giusto: nessuno ha risposto |

**Una distinzione che mancava.** «Il servizio ha risposto e non c'è» è diverso da «il
servizio non ha risposto». Prima erano la stessa cosa, quindi un guasto di rete marcava il
circolo come introvabile in modo definitivo. Ora l'errore viene propagato solo se *nessuna*
delle quattro strade ha risposto pulito.

**Niente più blocchi da 40.** Con Photon si regge un ritmo più alto: la ricerca va avanti
fino in fondo da sola, col pulsante Ferma sempre disponibile e quello che ha trovato salvato.

**`GEOVERSIONE` alzata a 3**, così i circoli scartati da Nominatim tornano in coda: sarebbe
inutile aggiungere un archivio nuovo e non far riprovare chi era stato dato per perso.

**Un messaggio che mentiva.** La barra diceva «Questi non erano su OpenStreetMap» basandosi
su `OSMFATTO`, che significa solo «l'import è partito», non «l'import ha funzionato». Con
tutte e nove le zone in errore affermava lo stesso quella frase, che è falsa e manda fuori
strada. Ora c'è `OSMRESA`, vera solo se le zone sono arrivate davvero.

## r8 — quello che ho provato invece di supporre

Il 12 agosto ho interrogato i sette server Overpass **dal browser**, uno per uno:

| | esito |
|---|---|
| `overpass.osm.ch` | 200, ma 1 campo dove ce ne sono 5-6 — archivio parziale |
| `overpass-api.de` | 406, poi bloccato da CORS |
| `overpass.openstreetmap.fr` | 403, poi bloccato da CORS |
| `overpass.osm.jp` | il dominio non esiste più |
| `maps.mail.ru` | nessuna risposta |
| **`photon.komoot.io`** | **200, risultati: 1** |
| **`nominatim.openstreetmap.org`** | **200, risultati: 1** |

Quattro di quei sette li avevo aggiunti io in r3 **senza provarli**. Non hanno aumentato le
probabilità di successo: hanno solo allungato il giro a vuoto. Tolti.

Ho anche verificato l'altra ipotesi che avevo — che l'ordine dei parametri `out center tags`
fosse sbagliato. Non lo era: le due forme danno lo stesso risultato. Ipotesi eliminata in
trenta secondi invece che con un'altra release.

**Conseguenza**: l'import da Overpass non può essere la strada principale. Photon e
Nominatim rispondono, quindi la ricerca indirizzi diventa l'azione principale e l'import
resta per buche e tracciato del percorso.

**Un guasto che sarebbe rimasto invisibile.** Se un archivio risponde benissimo ma i suoi
risultati vengono tutti scartati dal controllo di distanza, dall'esterno è
indistinguibile da un archivio che non risponde — eppure sono due guasti opposti che si
curano in modo opposto. Ora c'è un contatore: `GolfP.diagnosi().ricercaIndirizzi` dice
quante risposte sono arrivate, quante accettate, quante scartate perché troppo lontane e
quanti guasti di rete. E alla fine della ricerca compare un resoconto in console.

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
