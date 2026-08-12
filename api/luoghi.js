/* api/luoghi.js — proxy verso Google Places API (New), ricerca per testo.
 *
 * Perche esiste, accanto a geocodifica.js: un circolo di golf non e un indirizzo,
 * e un luogo. Il Geocoding sa tradurre "Via Machetto 1, Desenzano" in un punto sulla
 * strada, ma se l'indirizzo postale e la segreteria e la club house sta due chilometri
 * dentro il parco, la strada e la risposta sbagliata alla domanda giusta. Places invece
 * conosce il circolo come attivita, con la posizione messa da chi lo gestisce: e la
 * stessa bandierina che si vede aprendo Google Maps.
 *
 * Corpo atteso:  { luoghi: [ { id, q, lat, lon }, ... ] }
 *   q       = cosa cercare (nome del circolo + comune), composto dal client
 *   lat/lon = il comune dichiarato dalla FIG, usato per orientare la ricerca
 *
 * Risposta:      { risultati: [ { id, lat, lon, nome, indirizzo, tipi, golf } | { id, vuoto:true } ] }
 *
 * Sui costi: la ricerca per testo con nome, indirizzo e posizione sta nella fascia Pro,
 * che ha una quota mensile gratuita ampia. Chiediamo esattamente quei tre campi e basta:
 * la fascia di prezzo la decide il campo piu caro che chiedi, quindi aggiungere qui
 * valutazioni o recensioni farebbe salire il conto di tutte le chiamate.
 */

const MAX_BLOCCO = 40;
const CAMPI = 'places.location,places.displayName,places.formattedAddress,places.types,places.primaryType';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errore: 'Metodo non consentito.' });
  }

  /* La funzione sta su un indirizzo pubblico e porta con se una chiave a consumo:
     passano solo le chiamate che arrivano dal sito. */
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
  const lista = Array.isArray(body.luoghi) ? body.luoghi.slice(0, MAX_BLOCCO) : null;
  if (!lista || !lista.length) {
    return res.status(400).json({ errore: 'Corpo non valido: manca luoghi[].' });
  }

  const risultati = [];
  for (const voce of lista) {
    const q = String(voce.q || '').trim();
    if (!q) { risultati.push({ id: voce.id, vuoto: true, motivo: 'niente da cercare' }); continue; }

    const richiesta = {
      textQuery: q,
      languageCode: 'it',
      regionCode: 'IT',
      maxResultCount: 3
    };
    /* Il comune della FIG non restringe la ricerca, la orienta: fra due circoli con
       nome simile Google propone per primo quello vicino al punto indicato. Il
       controllo vero sulla distanza lo fa il client, che sa anche quanto e attendibile
       il punto di partenza. */
    if (isFinite(voce.lat) && isFinite(voce.lon)) {
      richiesta.locationBias = {
        circle: { center: { latitude: +voce.lat, longitude: +voce.lon }, radius: 30000 }
      };
    }

    try {
      const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': chiave,
          'X-Goog-FieldMask': CAMPI
        },
        body: JSON.stringify(richiesta)
      });
      const j = await r.json();

      /* Chiave non autorizzata, API spenta, quota finita: non sono "non trovato".
         Se li confondessimo, il client marcherebbe come introvabili dei circoli che
         non ha mai davvero cercato, e non si riproverebbero piu. */
      if (!r.ok) {
        const msg = (j && j.error && j.error.message) || `HTTP ${r.status}`;
        return res.status(502).json({ errore: 'Google Places: ' + msg, fattiPrima: risultati });
      }

      const posti = Array.isArray(j.places) ? j.places : [];
      if (!posti.length) { risultati.push({ id: voce.id, vuoto: true, motivo: 'nessun luogo trovato' }); continue; }

      /* Fra i primi tre si prende il primo che Google riconosce come campo da golf.
         E il controllo che il geocoding non poteva fare: distingue il circolo dal bar
         omonimo sulla stessa via, e dice se il posto e davvero quello che cerchiamo. */
      const eGolf = p => {
        const t = [].concat(p.types || [], p.primaryType || []);
        return t.some(x => /golf/i.test(String(x)));
      };
      const scelto = posti.find(eGolf) || posti[0];
      const loc = scelto.location;
      if (!loc || !isFinite(loc.latitude)) {
        risultati.push({ id: voce.id, vuoto: true, motivo: 'luogo senza coordinate' });
        continue;
      }

      risultati.push({
        id: voce.id,
        lat: loc.latitude, lon: loc.longitude,
        nome: (scelto.displayName && scelto.displayName.text) || null,
        indirizzo: scelto.formattedAddress || null,
        tipi: scelto.types || [],
        golf: eGolf(scelto)
      });
    } catch (e) {
      risultati.push({ id: voce.id, vuoto: true, motivo: 'rete: ' + (e.message || 'errore') });
    }
  }

  return res.status(200).json({ risultati });
}
 
