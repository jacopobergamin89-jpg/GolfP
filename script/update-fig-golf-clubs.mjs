#!/usr/bin/env node
/**
 * update-fig-golf-clubs.mjs
 *
 * Scarica l'elenco ufficiale dei circoli di golf dalla Federazione Italiana Golf (FIG)
 * e genera il file data/circoli_fig_italia.csv.
 *
 * Uso:
 *   node scripts/update-fig-golf-clubs.mjs
 *
 * Dipendenze: solo Node.js standard library (https, fs, path, url)
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'circoli_fig_italia.csv');
const FIG_URL = 'https://areariservata.federgolf.it/GolfClub/Index';

/** Fetch a URL and return the body as string, following up to maxRedirects redirects */
function fetchPage(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GolfP-updater/1.0)' } }, (res) => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          return reject(new Error(`Too many redirects from ${url}`));
        }
        return resolve(fetchPage(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Minimal HTML entity decoder for common entities.
 */
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Strip HTML tags and normalise whitespace */
function stripTags(str) {
  return decodeEntities(str.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Parse address string of the form:
 *   "VIA CARABINIERI S.N.C. (35031) ABANO TERME PD"
 * into { indirizzo, CAP, comune, provincia }.
 */
function parseAddress(raw) {
  const m = raw.match(/^(.*?)\s*\((\d{5})\)\s+(.*?)\s+([A-Z]{2})\s*$/);
  if (m) {
    return {
      indirizzo: m[1].trim(),
      CAP: m[2],
      comune: m[3].trim(),
      provincia: m[4],
    };
  }
  // Fallback: keep raw text in indirizzo
  return { indirizzo: raw, CAP: '', comune: '', provincia: '' };
}

/** Wrap a value for CSV: quote if it contains comma, double-quote or newline */
function csvField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowToCsv(fields) {
  return fields.map(csvField).join(',');
}

/**
 * Parse the FIG HTML page and return an array of club objects.
 *
 * The page uses a table with rows like:
 *   <tr>
 *     <td>NOME</td>
 *     <td>INDIRIZZO (CAP) COMUNE PR</td>
 *     <td>TELEFONO</td>
 *     <td>FAX</td>
 *     <td>EMAIL</td>
 *     <td>SITO WEB</td>
 *   </tr>
 */
function parseHtml(html) {
  const clubs = [];

  // Extract all <tr> blocks
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1];

    // Extract all <td> values
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let tdMatch;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }

    // Skip header rows or rows with too few cells
    if (cells.length < 2) continue;
    if (cells[0].toLowerCase() === 'nome' || cells[0].toLowerCase() === 'circolo') continue;

    const nome = cells[0] || '';
    if (!nome) continue;

    const rawAddress = cells[1] || '';
    const { indirizzo, CAP, comune, provincia } = parseAddress(rawAddress);
    const telefono = cells[2] || '';

    // The FIG table may have 5 columns (no fax) or 6 columns (with fax).
    // Layout with fax:    nome | indirizzo | telefono | fax | email | sito_web
    // Layout without fax: nome | indirizzo | telefono | email | sito_web
    let rawEmail, rawSito;
    if (cells.length >= 6) {
      // cells[3] = fax (ignored), cells[4] = email, cells[5] = sito_web
      rawEmail = cells[4] || '';
      rawSito  = cells[5] || '';
    } else {
      // cells[3] = email, cells[4] = sito_web
      rawEmail = cells[3] || '';
      rawSito  = cells[4] || '';
    }

    const resolvedEmail = rawEmail.includes('@') ? rawEmail : '';
    const resolvedSito =
      rawSito.match(/^https?:\/\//i) || rawSito.match(/^www\./i) ? rawSito : '';

    clubs.push({ nome, indirizzo, CAP, comune, provincia, telefono, email: resolvedEmail, sito_web: resolvedSito });
  }

  return clubs;
}

async function main() {
  /* Scorciatoia per il caso normale: la pagina si salva a mano da un browser
     dove hai gia fatto il login, e si passa allo script. */
  let html;
  if (process.env.FIG_HTML) {
    console.log(`Reading local copy: ${process.env.FIG_HTML}`);
    html = fs.readFileSync(process.env.FIG_HTML, 'utf8');
  } else {
    console.log(`Downloading FIG golf club list from ${FIG_URL} ...`);
    try {
      html = await fetchPage(FIG_URL);
    } catch (err) {
      console.error('Failed to download page:', err.message);
      console.error('Se la pagina richiede il login: FIG_HTML=percorso/file.html node scripts/update-fig-golf-clubs.mjs');
      process.exit(1);
    }
  }

  const clubs = parseHtml(html);
  console.log(`Parsed ${clubs.length} clubs.`);

  /* La pagina FIG sta dietro l'area riservata: senza credenziali il parser trova
     zero righe. Prima lo script scriveva comunque il file e cancellava i record
     gia raccolti. Un aggiornamento che non riesce non deve distruggere i dati. */
  const esistenti = fs.existsSync(OUTPUT_FILE)
    ? fs.readFileSync(OUTPUT_FILE, 'utf8').split('\n').filter(Boolean).length - 1
    : 0;
  if (clubs.length < 300 || clubs.length < esistenti * 0.9) {
    console.error(
      `Interrotto: letti solo ${clubs.length} circoli` +
      (esistenti ? ` contro i ${esistenti} gia presenti` : '') +
      '. Il file NON e stato toccato.\n' +
      'Con ogni probabilita la pagina richiede il login: scarica l HTML a mano ' +
      'da un browser autenticato e passalo con FIG_HTML=percorso/file.html'
    );
    process.exit(2);
  }
  console.log(`Parsed ${clubs.length} clubs (FIG page typically lists ~341).`);

  const header = 'nome,indirizzo,CAP,comune,provincia,telefono,email,sito_web';
  const rows = clubs.map((c) =>
    rowToCsv([c.nome, c.indirizzo, c.CAP, c.comune, c.provincia, c.telefono, c.email, c.sito_web])
  );

  const csvContent = [header, ...rows].join('\n') + '\n';

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');
  console.log(`Written ${clubs.length} records to ${OUTPUT_FILE}`);
}

main();
