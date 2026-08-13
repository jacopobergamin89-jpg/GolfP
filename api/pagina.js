/* api/pagina.js — scarica una pagina web e ne restituisce il testo.
 *
 * Perche sul server e non nel browser: un sito non autorizza le pagine altrui a leggerlo
 * (e la regola CORS), quindi dal browser la richiesta viene rifiutata prima ancora di
 * partire. Il server invece e un normale visitatore e la pagina la vede.
 *
 * Cosa fa oltre a scaricare: butta via script, stili, menu e piede pagina, e riduce tutto
 * a testo. Serve perche la pagina va poi letta da Gemini, e mandargli 300 KB di HTML
 * costa venti volte piu che mandargli 15 KB di testo, senza aggiungere niente di utile.
 *
 * Corpo:     { url: "https://..." }
 * Risposta:  { testo, titolo, url } oppure { errore }
 */

const MAX_BYTE = 2 * 1024 * 1024;      // oltre non e una pagina, e un download
const MAX_TESTO = 18000;               // caratteri passati a Gemini

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito.' });

  const origine = req.headers.origin || req.headers.referer || '';
  const host = req.headers.host || '';
  let ammessa = false;
  try { ammessa = !!origine && new URL(origine).host === host; } catch (e) { ammessa = false; }
  if (!ammessa) return res.status(403).json({ errore: 'Richiesta non ammessa.' });

  let url;
  try { url = new URL(String((req.body || {}).url || '')); }
  catch (e) { return res.status(400).json({ errore: 'Indirizzo non valido.' }); }

  /* Senza questo controllo la funzione diventa uno strumento per farsi leggere indirizzi
     interni della rete di Vercel da chiunque passi un url. */
  if (!/^https?:$/.test(url.protocol)) return res.status(400).json({ errore: 'Solo http e https.' });
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(url.hostname))
    return res.status(400).json({ errore: 'Indirizzo interno non consentito.' });

  try {
    const r = await fetch(url.href, {
      redirect: 'follow',
      headers: {
        /* Dichiararsi per quel che si e: molti siti rifiutano le richieste senza
           identificazione, e chi vuole escluderci deve poterlo fare. */
        'User-Agent': 'GolfP/1.0 (app personale per registrare giri di golf)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it,en'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) return res.status(200).json({ errore: `il sito ha risposto ${r.status}` });

    const tipo = r.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(tipo))
      return res.status(200).json({ errore: 'non e una pagina html (' + tipo.split(';')[0] + ')' });

    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTE) return res.status(200).json({ errore: 'pagina troppo pesante' });
    let html = new TextDecoder('utf-8').decode(buf);

    const titolo = (html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [, ''])[1]
      .replace(/\s+/g, ' ').trim();

    const testo = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      /* Le tabelle sono il punto: rating e slope delle partenze stanno quasi sempre li.
         Righe e celle diventano a capo e barre verticali, cosi la griglia sopravvive
         alla conversione in testo invece di diventare una fila di numeri senza ordine. */
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/t[dh]>/gi, ' | ')
      .replace(/<\/(p|div|li|h[1-6]|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&egrave;/g, 'è')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return res.status(200).json({
      url: r.url, titolo,
      testo: testo.slice(0, MAX_TESTO),
      tagliato: testo.length > MAX_TESTO
    });
  } catch (e) {
    const m = e.name === 'TimeoutError' ? 'il sito non ha risposto in tempo' : (e.message || 'errore di rete');
    return res.status(200).json({ errore: m });
  }
}
