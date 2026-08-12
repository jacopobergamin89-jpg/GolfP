#!/usr/bin/env node
/**
 * posizioni-osm.mjs
 *
 * Cerca i golf course su OpenStreetMap e confronta le coordinate con quelle
 * ottenute dagli indirizzi FIG/Google. Produce un audit e NON riscrive index.html.
 *
 * Perche esiste
 * -------------
 * L'app sa cercare gli indirizzi da sola, ma lo fa su Nominatim, un circolo alla
 * volta, un secondo l'uno: quasi trecento circoli sono una decina di minuti da
 * far partire a mano in blocchi da quaranta. E ogni telefono nuovo ricomincia da
 * capo, perche il risultato vive nella memoria del browser.
 *
 * Overpass risponde in blocco e restituisce coordinate e dati OSM del campo. Questi
 * dati servono come controllo indipendente e per arricchire la scheda, non per
 * sostituire automaticamente le coordinate FIG/Google.
 *
 * Uso
 * ---
 *   node script/posizioni-osm.mjs              # crea data/audit_osm.csv
 *   node script/posizioni-osm.mjs --prova      # esegue la ricerca ma non scrive il report
 *
 * Non tocca i circoli su cui hai usato il mirino o il "Non e qui": quelli restano
 * decisi da te, l'app li protegge quando applica questa tabella.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', 'index.html');
const PROVA = process.argv.includes('--prova');

const SPECCHI = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

/* Gli stessi riquadri che usa l'app: richieste piccole, meno rifiuti dal server. */
const RIQUADRI = [
  ['Piemonte e Liguria', 43.7, 6.5, 46.5, 9.3],
  ['Lombardia', 44.6, 8.4, 46.7, 10.7],
  ['Triveneto', 44.7, 10.5, 47.2, 13.9],
  ['Emilia e Toscana', 42.5, 9.3, 45.2, 13.0],
  ['Centro', 41.2, 11.4, 43.9, 14.9],
  ['Adriatico sud', 39.7, 14.3, 42.6, 18.7],
  ['Tirreno sud', 37.8, 12.8, 41.4, 16.4],
  ['Sicilia', 36.5, 11.8, 38.5, 15.9],
  ['Sardegna', 38.7, 7.8, 41.4, 10.0]
];

/* ---- le stesse regole di confronto dei nomi che usa l'app -------------------
   Devono restare identiche, altrimenti la tabella aggancia circoli diversi da
   quelli che l'app si aspetta. */
const nocciolo = x => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(golf|club|circolo|country|resort|societa|sportiva|asd|ssd|the|il|la|le|lo|i|gli|dei|del|della|di|e|&)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

const GENERICI = new Set(['golf', 'club', 'circolo', 'country', 'resort', 'societa', 'sportiva', 'asd', 'ssd',
  'the', 'il', 'la', 'le', 'lo', 'i', 'gli', 'dei', 'del', 'della', 'di', 'e', 'academy', 'sporting']);
const parole = x => (x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .split(/[^a-z0-9]+/).filter(p => p && !GENERICI.has(p));

function stessoNome(a, b) {
  const A = parole(a), B = parole(b);
  if (!A.length || !B.length) return false;
  const [c, l] = A.length <= B.length ? [A, B] : [B, A];
  if (!c.every(p => l.includes(p))) return false;
  return c.some(p => p.length >= 5);
}

function km(la1, lo1, la2, lo2) {
  const R = 6371, r = Math.PI / 180;
  const dla = (la2 - la1) * r, dlo = (lo2 - lo1) * r;
  const a = Math.sin(dla / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const attesa = ms => new Promise(r => setTimeout(r, ms));

/* Qui si puo aspettare molto piu che nel browser: nessuno sta guardando lo schermo.
   Sette specchi per sei passate, con attese che arrivano al minuto e mezzo: in tutto
   fino a una decina di minuti prima di dichiarare buca. Overpass e gratuito e nelle
   ore di punta e saturo, ma prima o poi una finestra si apre sempre. */
const ATTESE = [5000, 15000, 40000, 90000, 90000];
async function overpass(query) {
  let ultimo = null;
  for (let giro = 0; giro <= ATTESE.length; giro++) {
    for (const url of SPECCHI) {
      const nome = new URL(url).host;
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query)
        });
        if (r.status === 429 || r.status === 503 || r.status === 504) {
          ultimo = `${nome} occupato`;
          const dopo = parseInt(r.headers.get('retry-after') || '', 10);
          if (isFinite(dopo) && dopo > 0 && dopo < 60) await attesa(dopo * 1000);
          continue;
        }
        if (!r.ok) { ultimo = `${nome}: risposta ${r.status}`; continue; }
        return await r.json();
      } catch (e) { ultimo = `${nome}: ${e.message || e}`; }
    }
    if (giro < ATTESE.length) {
      const sec = Math.round(ATTESE[giro] / 1000);
      process.stdout.write(`tutti occupati, riprovo fra ${sec}s… `);
      await attesa(ATTESE[giro]);
    }
  }
  throw new Error(ultimo || 'nessuno specchio ha risposto');
}

/* ---- l'elenco dei circoli si legge dall'app stessa --------------------------
   Cosi non ci sono due elenchi da tenere allineati: la fonte resta index.html. */
function circoliDaFile(html) {
  const sandbox = {};
  const pezzo = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  /* Bastano IT, ES, LOMBARDIA, REGIONI, SOLONOMI, NUOVI e INDIRIZZI: si prendono
     i blocchi per nome, senza eseguire il resto dell'app. */
  const blocchi = ['IT', 'ES', 'LOMBARDIA', 'REGIONI', 'SOLONOMI', 'NUOVI', 'INDIRIZZI', 'REGCENTRO', 'PROV'];
  let codice = '';
  for (const nome of blocchi) {
    const i = pezzo.indexOf(`const ${nome} = `);
    if (i < 0) { console.error(`Blocco ${nome} non trovato in index.html.`); process.exit(1); }
    // fine del blocco: la prima riga che chiude con "];" o "};" a inizio riga
    const chiusuraA = pezzo.indexOf('\n];', i), chiusuraB = pezzo.indexOf('\n};', i);
    const fine = Math.min(...[chiusuraA, chiusuraB].filter(x => x > 0));
    codice += pezzo.slice(i, fine + 3) + '\n';
  }
  const nomi = new Set();
  const fn = new Function(codice + `
    const out = [];
    IT.forEach(r => out.push(r[0]));
    ES.forEach(r => out.push(r[0]));
    LOMBARDIA.forEach(r => out.push(r[1]));
    Object.values(REGIONI).forEach(v => v.forEach(r => out.push(r[1])));
    Object.values(SOLONOMI).forEach(v => v.forEach(n => out.push(n)));
    NUOVI.forEach(r => out.push(r[1]));
    Object.keys(INDIRIZZI).forEach(n => out.push(n));
    return { nomi: out, INDIRIZZI };
  `);
  const { nomi: lista, INDIRIZZI } = fn();
  lista.forEach(n => n && nomi.add(n));
  return { nomi: [...nomi], INDIRIZZI };
}

async function main() {
  const html = fs.readFileSync(FILE, 'utf8');
  const { nomi, INDIRIZZI } = circoliDaFile(html);
  console.log(`${nomi.length} circoli da risolvere.`);

  /* --- una passata su OpenStreetMap ------------------------------------- */
  const campi = [];
  const visti = new Set();
  for (const [zona, S, W, N, E] of RIQUADRI) {
    process.stdout.write(`  ${zona}… `);
    const q = `[out:json][timeout:40][maxsize:33554432];
      (nwr["leisure"="golf_course"](${S},${W},${N},${E});
       nwr["sport"="golf"]["name"](${S},${W},${N},${E}););
      out center tags;`;
    let j;
    try { j = await overpass(q); }
    catch (e) { console.log(`saltata (${e.message})`); continue; }
    let n = 0;
    for (const e of j.elements || []) {
      const chiave = e.type + '/' + e.id;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      const tg = e.tags || {};
      const nome = tg.name || tg['name:it'];
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
      if (!nome || !isFinite(lat) || !isFinite(lon)) continue;
      campi.push({
        nome, lat: +lat.toFixed(6), lon: +lon.toFixed(6),
        via: tg['addr:street']
          ? tg['addr:street'] + (tg['addr:housenumber'] ? ' ' + tg['addr:housenumber'] : '')
          : null,
        cap: tg['addr:postcode'] || null,
        buche: parseInt(tg.holes, 10) || null
      });
      n++;
    }
    console.log(`${n} campi`);
    await attesa(1500);
  }
  console.log(`${campi.length} campi scaricati da OpenStreetMap.\n`);
  if (campi.length < 100) {
    console.error('Troppo pochi: qualcosa non ha funzionato. Non tocco il file.');
    process.exit(2);
  }

  /* --- aggancio nome per nome -------------------------------------------
     Prima il nome identico, poi il confronto parola per parola. Nel secondo caso
     serve una conferma: se l'app conosce il comune del circolo, il campo trovato
     deve stare entro 25 km, altrimenti si scarta. Meglio una posizione in meno
     che una sbagliata: un segnaposto giusto per caso non si distingue da uno
     giusto davvero, e poi non lo controlla piu nessuno. */
  const perNocciolo = new Map();
  campi.forEach(c => {
    const k = nocciolo(c.nome);
    if (k.length > 3 && !perNocciolo.has(k)) perNocciolo.set(k, c);
  });

  const tabella = {};
  let esatti = 0, perParole = 0, scartati = 0, senza = [];
  for (const nome of nomi) {
    const k = nocciolo(nome);
    let hit = k.length > 3 ? perNocciolo.get(k) : null;
    let via = 'nome identico';
    if (!hit) {
      const cand = campi.filter(c => stessoNome(c.nome, nome));
      if (cand.length === 1) { hit = cand[0]; via = 'parola per parola'; }
      else if (cand.length > 1) { scartati++; senza.push(`${nome} (${cand.length} candidati)`); continue; }
    }
    if (!hit) { senza.push(nome); continue; }

    const ind = INDIRIZZI[nome];
    if (ind && isFinite(ind[2]) && km(ind[2], ind[3], hit.lat, hit.lon) > 25) {
      scartati++;
      senza.push(`${nome} (trovato a ${km(ind[2], ind[3], hit.lat, hit.lon).toFixed(0)} km dal comune)`);
      continue;
    }
    tabella[nome] = [hit.lat, hit.lon, hit.via, hit.cap, hit.buche];
    if (via === 'nome identico') esatti++; else perParole++;
  }

  const conVia = Object.values(tabella).filter(v => v[2]).length;
  console.log(`Risolti ${Object.keys(tabella).length} circoli — ${esatti} per nome identico, ${perParole} parola per parola.`);
  console.log(`Di questi, ${conVia} con la via esatta.`);
  console.log(`Scartati per sicurezza: ${scartati}. Senza riscontro: ${senza.length - scartati}.`);
  if (senza.length) console.log('\nRestano da cercare dall\'app:\n  ' + senza.slice(0, 40).join('\n  ')
    + (senza.length > 40 ? `\n  …e altri ${senza.length - 40}` : ''));

  if (PROVA) { console.log('\n--prova: il file non e stato toccato.'); return; }

  /* OSM è soltanto un controllo indipendente: non riscrive più index.html. */
  const GEO = path.join(path.dirname(FILE), 'data', 'coordinate_fig.json');
  const AUDIT = path.join(path.dirname(FILE), 'data', 'audit_osm.csv');
  if (!fs.existsSync(GEO)) {
    console.error(`Manca ${GEO}. Prima esegui: GOOGLE_MAPS_KEY=... node script/geocodifica-fig.mjs`);
    process.exit(4);
  }
  const gj = JSON.parse(fs.readFileSync(GEO, 'utf8'));
  const google = new Map((gj.risultati || []).filter(x => x && x.nome).map(x => [x.nome, x]));
  const rows = [];
  for (const nome of nomi) {
    const g = google.get(nome);
    const k = nocciolo(nome);
    let hit = k.length > 3 ? perNocciolo.get(k) : null;
    let metodo = hit ? 'nome identico' : '';
    if (!hit) {
      const cand = campi.filter(c => stessoNome(c.nome, nome));
      if (cand.length === 1) { hit = cand[0]; metodo = 'parole'; }
      else if (cand.length > 1) { rows.push({ nome, stato: 'OSM_AMBIGUO', metodo: '', distanza_km: '', google_stato: g?.stato || '' }); continue; }
    }
    if (!hit) { rows.push({ nome, stato: 'OSM_NON_TROVATO', metodo: '', distanza_km: '', google_stato: g?.stato || '' }); continue; }
    const distanza = g?.lat != null && g?.lon != null ? km(g.lat, g.lon, hit.lat, hit.lon) : null;
    let stato = 'DA_VERIFICARE';
    if (g?.lat == null || g?.lon == null) stato = 'GOOGLE_NON_DISPONIBILE';
    else if (g.stato === 'AUTO_OK' && distanza <= 0.5) stato = 'OK';
    else if (distanza <= 1.5) stato = 'CONTROLLO';
    else stato = 'SOSPETTO';
    rows.push({
      nome, stato, metodo, distanza_km: distanza == null ? '' : distanza.toFixed(3),
      google_stato: g?.stato || '', google_precisione: g?.precisione || '',
      google_lat: g?.lat ?? '', google_lon: g?.lon ?? '',
      osm_lat: hit.lat, osm_lon: hit.lon, osm_via: hit.via || '', osm_cap: hit.cap || ''
    });
  }
  const headers = ['nome','stato','metodo','distanza_km','google_stato','google_precisione','google_lat','google_lon','osm_lat','osm_lon','osm_via','osm_cap'];
  const esc = v => '"' + String(v ?? '').replaceAll('"','""') + '"';
  fs.writeFileSync(AUDIT, headers.join(',') + '\n' + rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n') + '\n');
  const counts = rows.reduce((a,r) => { a[r.stato]=(a[r.stato]||0)+1; return a; }, {});
  console.log('\nAudit OSM completato:', counts);
  console.log(`Creato ${AUDIT}`);
  console.log('IMPORTANTE: index.html non viene modificato.');
}

main().catch(e => { console.error('Interrotto:', e.message); process.exit(1); });
