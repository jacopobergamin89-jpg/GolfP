// Vercel serverless function — /api/leggi
// Riceve dal browser il corpo di una richiesta Gemini (immagine + istruzioni + schema)
// e lo inoltra a Google aggiungendo la chiave, che resta sul server.
//
// Variabile d'ambiente da impostare su Vercel: GEMINI_API_KEY
// Facoltativa: GEMINI_MODELS (elenco separato da virgole, in ordine di preferenza)

const MODELLI_DEFAULT = ['gemini-3.6-flash', 'gemini-3.5-flash'];
const MAX_BODY = 12 * 1024 * 1024; // ~12 MB: una foto di scorecard sta abbondantemente dentro

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errore: 'Usa POST.' });
  }
  const chiave = process.env.GEMINI_API_KEY;
  if (!chiave) {
    return res.status(500).json({ errore: 'GEMINI_API_KEY non impostata nelle variabili di ambiente.' });
  }

  const body = req.body;
  if (!body || !Array.isArray(body.contents)) {
    return res.status(400).json({ errore: 'Corpo non valido: manca contents.' });
  }
  if (JSON.stringify(body).length > MAX_BODY) {
    return res.status(413).json({ errore: 'Immagine troppo grande. Riducila prima di inviarla.' });
  }

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
          body: JSON.stringify(body)
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
