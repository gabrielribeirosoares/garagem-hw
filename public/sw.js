const CACHE_NAME = 'garagem-hw-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.html',
  '/assets/css/styles.css',
  '/assets/js/app.js',
  '/assets/js/auth.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Força a atualização imediata
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos um truque para não falhar se um arquivo não existir
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.log(`Falha ao cachear ${url}`, err)))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  // Limpa o cache antigo (v1) que quebrou o iOS
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // TRAVA DE SEGURANÇA PARA O FIREBASE NO IOS:
  // Só intercepta navegação local (ignora APIs, Auth e Firestore)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        console.log("Erro de fetch ou offline");
      });
    })
  );
});