/* GolfP — service worker.
   Regola: la pagina si prende sempre dalla rete quando c'è, e si tiene una copia
   solo per quando la rete manca. Il contrario (cache prima) farebbe vedere una
   versione vecchia dopo ogni aggiornamento, ed è esattamente quello che non serve
   a un'app che cambia spesso. */
/* La cache porta il numero di versione: cambiando release la vecchia copia viene
   buttata da sola in `activate`, e non serve piu il ricaricamento forzato a mano. */
const RELEASE = 33;
const CACHE = 'golfp-r' + RELEASE;
const BASE = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (url.origin !== self.location.origin) return;   // mappe, Drive, Gemini: mai toccati
  e.respondWith(
    fetch(r).then(risposta => {
      const copia = risposta.clone();
      caches.open(CACHE).then(c => c.put(r, copia)).catch(() => {});
      return risposta;
    }).catch(() => caches.match(r).then(c => c || caches.match('/index.html')))
  );
});
