const CACHE_NAME = 'from-the-day-v5';
const ASSETS = ['./', 'index.html', 'style.css', 'script.js', 'manifest.json', 'language.json', 'icon192.png', 'icon512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
// stale-while-revalidate: responde rápido desde caché y actualiza en segundo plano
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached || cache.match('index.html'));
    return cached || net;
  }));
});
