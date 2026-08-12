#!/usr/bin/env node
/**
 * Geocodifica degli indirizzi FIG.
 *
 * Fonte primaria: data/circoli_fig_italia.csv
 * Fonte coordinate: Google Geocoding API (GOOGLE_MAPS_KEY)
 * Output: data/coordinate_fig.json + data/coordinate_fig_audit.csv
 *
 * NON usa Photon e NON usa il centro del comune come coordinata finale.
 * Un risultato APPROXIMATE o partial_match viene marcato come DA_VERIFICARE.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSV = path.join(ROOT, 'data', 'circoli_fig_italia.csv');
const JSON_OUT = path.join(ROOT, 'data', 'coordinate_fig.json');
const AUDIT_OUT = path.join(ROOT, 'data', 'coordinate_fig_audit.csv');
const KEY = process.env.GOOGLE_MAPS_KEY;
const PROVA = process.argv.includes('--prova');
const ATTENDI = 120;

if (!KEY && !PROVA) {
  console.error('Manca GOOGLE_MAPS_KEY. Esempio: GOOGLE_MAPS_KEY=xxx node script/geocodifica-fig.mjs');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (ch === '"') {
      if (quote && nx === '"') { cell += '"'; i++; }
      else quote = !quote;
    } else if (ch === ',' && !quote) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quote) {
      if (ch === '\r' && nx === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const csvEscape = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
const stableId = r => [r.nome, r.indirizzo, r.CAP, r.comune, r.provincia].map(x => String(x || '').trim().toLowerCase()).join('|');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(q) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?' + new URLSearchParams({
    address: q, region: 'it', language: 'it', key: KEY
  });
  const r = await fetch(url);
  const j = await r.json();
  if (['OVER_QUERY_LIMIT', 'REQUEST_DENIED', 'INVALID_REQUEST'].includes(j.status)) {
    throw new Error(`Google ${j.status}${j.error_message ? ': ' + j.error_message : ''}`);
  }
  if (j.status !== 'OK' || !j.results?.length) return { stato: 'NON_TROVATO' };
  const x = j.results[0];
  const loc = x.geometry?.location;
  if (!loc) return { stato: 'NON_TROVATO' };
  const precisione = x.geometry.location_type || '';
  const parziale = !!x.partial_match;
  let stato = 'VERIFICABILE';
  if (precisione === 'ROOFTOP' && !parziale) stato = 'AUTO_OK';
  if (precisione === 'RANGE_INTERPOLATED') stato = 'VERIFICABILE';
  if (precisione === 'GEOMETRIC_CENTER' || precisione === 'APPROXIMATE' || parziale) stato = 'DA_VERIFICARE';
  return {
    lat: +loc.lat.toFixed(7), lon: +loc.lng.toFixed(7), precisione,
    parziale, indirizzo_google: x.formatted_address || null, stato
  };
}

const righe = parseCsv(fs.readFileSync(CSV, 'utf8'));
console.log(`${righe.length} indirizzi FIG caricati.`);
if (PROVA) { console.log('Solo prova: nessuna chiamata Google e nessun file sovrascritto.'); process.exit(0); }

const risultati = [];
for (let i = 0; i < righe.length; i++) {
  const r = righe[i];
  const q = [r.indirizzo, r.CAP, r.comune, r.provincia, 'Italia'].filter(Boolean).join(', ');
  process.stdout.write(`[${i + 1}/${righe.length}] ${r.nome}: ${q} … `);
  try {
    const g = await geocode(q);
    risultati.push({ id: stableId(r), nome: r.nome, indirizzo: r.indirizzo, CAP: r.CAP,
      comune: r.comune, provincia: r.provincia, query: q, ...g });
    console.log(g.stato + (g.precisione ? ` (${g.precisione})` : ''));
  } catch (e) {
    risultati.push({ id: stableId(r), nome: r.nome, indirizzo: r.indirizzo, CAP: r.CAP,
      comune: r.comune, provincia: r.provincia, query: q, stato: 'ERRORE', errore: e.message });
    console.log('ERRORE: ' + e.message);
    if (/OVER_QUERY_LIMIT|REQUEST_DENIED|INVALID_REQUEST/.test(e.message)) process.exit(2);
  }
  await sleep(ATTENDI);
}

fs.writeFileSync(JSON_OUT, JSON.stringify({ versione: new Date().toISOString(), fonte: 'FIG address + Google Geocoding', risultati }, null, 2));
const head = ['id','nome','indirizzo','CAP','comune','provincia','lat','lon','precisione','parziale','indirizzo_google','stato','errore'];
const out = [head.map(csvEscape).join(',')];
for (const r of risultati) out.push(head.map(k => csvEscape(r[k] ?? '')).join(','));
fs.writeFileSync(AUDIT_OUT, out.join('\n') + '\n');

const count = s => risultati.filter(x => x.stato === s).length;
console.log(`\nOK rooftop: ${count('AUTO_OK')}`);
console.log(`Da verificare: ${count('DA_VERIFICARE')}`);
console.log(`Verificabili: ${count('VERIFICABILE')}`);
console.log(`Non trovati: ${count('NON_TROVATO')}`);
console.log(`Errori: ${count('ERRORE')}`);
console.log(`Creati: ${path.relative(ROOT, JSON_OUT)} e ${path.relative(ROOT, AUDIT_OUT)}`);
