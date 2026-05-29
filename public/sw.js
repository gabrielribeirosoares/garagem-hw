const CACHE_NAME = 'garagem-hw-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.html',
  '/assets/css/styles.css',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/manifest.json'
];

// Instala o Service Worker e salva os arquivos principais no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Intercepta as requisições para carregar mais rápido
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna do cache se existir, senão busca na internet
      return response || fetch(event.request);
    })
  );
});