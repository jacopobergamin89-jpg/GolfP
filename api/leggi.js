// Vercel serverless function — /api/leggi
// Riceve dal browser il corpo di una richiesta Gemini (immagine + istruzioni + schema)
// e lo inoltra a Google aggiungendo la chiave, che resta sul server.
//
// Variabile d'ambiente da impostare su Vercel: GEMINI_API_KEY
// Facoltativa: GEMINI_MODELS (elenco separato da virgole, in ordine di preferenza)

const MODELLI_DEFAULT = ['gemini-3.6-flash', 'gemini-3.5-flash'];
const MAX_BODY = 4 * 1024 * 1024;  // 4 MB: sotto il limite di Vercel, e una foto ci sta larga

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errore: 'Usa POST.' });
  }
  const chiave = process.env.GEMINI_API_KEY;
  if (!chiave) {
    return res.status(500).json({ errore: 'GEMINI_API_KEY non impostata nelle variabili di ambiente.' });
  }

  /* La funzione sta su un indirizzo pubblico e porta con se la chiave Gemini.
     Senza questo controllo chiunque la trovi puo far girare le proprie richieste
     sul conto di chi la ospita. Passano solo le chiamate che arrivano dal sito. */
  const origine = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  const ammessa = !origine
    ? false
    : (() => {
        try { return new URL(origine).host === host; } catch (e) { return false; }
      })();
  if (!ammessa) {
    return res.status(403).json({ errore: 'Richiesta non ammessa: arriva da fuori dal sito.' });
  }

  const body = req.body;
  if (!body || !Array.isArray(body.contents)) {
    return res.status(400).json({ errore: 'Corpo non valido: manca contents.' });
  }
  /* Vercel taglia gia il corpo intorno ai 4,5 MB: il limite qui deve stare sotto,
     altrimenti non scatta mai e l'utente riceve un errore della piattaforma
     invece di un messaggio comprensibile. */
  if (JSON.stringify(body).length > MAX_BODY) {
    return res.status(413).json({ errore: 'Immagine troppo grande. Riducila prima di inviarla.' });
  }
  /* Solo i campi che servono: niente parametri arbitrari inoltrati a Google. */
  const pulito = { contents: body.contents };
  if (body.generationConfig) pulito.generationConfig = body.generationConfig;

  const modelli = (process.env.GEMINI_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const elenco = modelli.length ? modelli : MODELLI_DEFAULT;

  let ultimo = null;
  for (const modello of elenco) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chiave },
          body: JSON.stringify(pulito)
        }
      );
      if (r.ok) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(await r.json());
      }
      ultimo = { stato: r.status, dettaglio: await r.text() };
      if (r.status !== 404) break;   // 404 = modello inesistente: si prova il successivo
    } catch (e) {
      ultimo = { stato: 502, dettaglio: String(e) };
    }
  }
  return res.status(ultimo?.stato || 502).json({
    errore: 'Google non ha risposto correttamente.',
    dettaglio: ultimo?.dettaglio?.slice(0, 500) || null
  });
}
