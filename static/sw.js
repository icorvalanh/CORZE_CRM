const CACHE_NAME = 'corze-v2';
const STATIC_ASSETS = [
  '/static/css/main.css',
  '/static/js/main.js',
  '/static/assets/logo.png',
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  if (!url.pathname.startsWith('/static/') || evt.request.method !== 'GET') return;
  // JS/CSS con ?v= → network-first (version param garantiza frescura)
  const isVersioned = url.search.includes('v=');
  if (isVersioned) {
    evt.respondWith(
      fetch(evt.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(evt.request, clone));
        }
        return response;
      }).catch(() => caches.match(evt.request))
    );
  } else {
    evt.respondWith(
      caches.match(evt.request).then(cached => {
        if (cached) return cached;
        return fetch(evt.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(evt.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
  }
});
