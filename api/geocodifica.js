/* api/geocodifica.js — proxy verso Google Geocoding API.
 *
 * Perche esiste: la chiave Google non puo stare dentro index.html, che e pubblico.
 * Sta come variabile GOOGLE_MAPS_KEY su Vercel e non lascia mai il server.
 *
 * Riceve un blocco di indirizzi e restituisce le coordinate. A blocchi e non uno alla
 * volta perche trecento andate e ritorno verso una funzione serverless sono trecento
 * avvii a freddo: cosi sono una decina di chiamate.
 *
 * Corpo atteso:  { indirizzi: [ { id, q, lat, lon }, ... ] }
 *   q    = l'indirizzo da cercare, gia composto dal client
 *   lat/lon = il punto di partenza (centro comune), per il controllo di distanza
 *
 * Risposta:      { risultati: [ { id, lat, lon, precisione, parziale } | { id, vuoto:true } ] }
 */

const MAX_BLOCCO = 40;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errore: 'Metodo non consentito.' });
  }

  /* Stesso controllo del proxy Gemini: la funzione sta su un indirizzo pubblico e
     porta con se una chiave a consumo. Passano solo le chiamate dal sito. */
  const origine = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  let ammessa = false;
  try { ammessa = !!origine && new URL(origine).host === host; } catch (e) { ammessa = false; }
  if (!ammessa) {
    return res.status(403).json({ errore: 'Richiesta non ammessa: arriva da fuori dal sito.' });
  }

  const chiave = process.env.GOOGLE_MAPS_KEY;
  if (!chiave) {
    return res.status(500).json({
      errore: 'GOOGLE_MAPS_KEY non impostata su Vercel. Vedi le istruzioni in MAPPA.md.'
    });
  }

  const body = req.body || {};
  const lista = Array.isArray(body.indirizzi) ? body.indirizzi.slice(0, MAX_BLOCCO) : null;
  if (!lista || !lista.length) {
    return res.status(400).json({ errore: 'Corpo non valido: manca indirizzi[].' });
  }

  const risultati = [];
  for (const voce of lista) {
    const q = String(voce.q || '').trim();
    if (!q) { risultati.push({ id: voce.id, vuoto: true, motivo: 'indirizzo mancante' }); continue; }
    const url = 'https://maps.googleapis.com/maps/api/geocode/json?'
      + new URLSearchParams({ address: q, region: 'it', language: 'it', key: chiave });
    try {
      const r = await fetch(url);
      const j = await r.json();

      /* OVER_QUERY_LIMIT e REQUEST_DENIED non sono "non trovato": sono un problema di
         configurazione o di quota. Vanno distinti, altrimenti il client marcherebbe
         come introvabili dei circoli che non ha mai davvero cercato. */
      if (j.status === 'OVER_QUERY_LIMIT' || j.status === 'REQUEST_DENIED' || j.status === 'INVALID_REQUEST') {
        return res.status(502).json({
          errore: `Google ha risposto ${j.status}${j.error_message ? ': ' + j.error_message : ''}`,
          fattiPrima: risultati
        });
      }
      if (j.status !== 'OK' || !j.results || !j.results.length) {
        risultati.push({ id: voce.id, vuoto: true, motivo: j.status || 'nessun risultato' });
        continue;
      }
      const primo = j.results[0];
      const loc = primo.geometry && primo.geometry.location;
      if (!loc) { risultati.push({ id: voce.id, vuoto: true, motivo: 'risposta senza coordinate' }); continue; }

      /* location_type dice quanto e precisa la risposta:
           ROOFTOP              = il civico esatto
           RANGE_INTERPOLATED  = stimato fra due civici
           GEOMETRIC_CENTER    = centro della via
           APPROXIMATE         = il paese, o giu di li
         partial_match dice che Google ha dovuto adattare la ricerca.
         Li passiamo entrambi al client, che decide: non si scarta qui, cosi la regola
         resta scritta in un posto solo. */
      risultati.push({
        id: voce.id,
        lat: loc.lat, lon: loc.lng,
        precisione: primo.geometry.location_type || null,
        parziale: !!primo.partial_match,
        indirizzo: primo.formatted_address || null
      });
    } catch (e) {
      risultati.push({ id: voce.id, vuoto: true, motivo: 'rete: ' + (e.message || 'errore') });
    }
  }

  return res.status(200).json({ risultati });
}
