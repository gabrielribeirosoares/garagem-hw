const CACHE_NAME = 'garagem-hw-v5';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  './assets/css/styles.css',
  './app.js',
  './auth.js',
  './data.js',
  './data_kaido.js',
  './firebase-config.js',
  './manifest.json',
  './assets/img/placeholder.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      }).catch(() => {
        if (event.request.destination === 'image' || event.request.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          return caches.match('./assets/img/placeholder.png');
        }
      });
    })
  );
});