const CACHE_NAME = 'uni-ucsm-v6';
const BASE = '/Uni/';

// Archivos estáticos a cachear al instalar
// NOTA: Chart.js y PDF.js son lazy-load — el SW los cachea dinámicamente
// en el fetch handler la primera vez que se descargan, no al instalar.
const STATIC_ASSETS = [
  BASE + 'uni.html',
  BASE + 'manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@400;500&family=Syne:wght@400;500;600;700&display=swap'
];

// ── INSTALL: cachear archivos estáticos ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: cache-first para estáticos, red-first para el resto ───────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Archivos propios + CDN estáticos: cache-first
  const isStatic = STATIC_ASSETS.some(a => url.includes(a.replace(BASE, '')))
    || url.includes('fonts.googleapis')
    || url.includes('fonts.gstatic')
    || url.includes('cdnjs.cloudflare.com');

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        }).catch(() => caches.match(BASE + 'uni.html'));
      })
    );
    return;
  }

  // Todo lo demás: red primero, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
