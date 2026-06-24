const CACHE_NAME = 'nako-toolbox-v17-icon-restore';
const ASSETS = [
  './',
  './index.html',
  './name-replacer.html',
  './word-replacer.html',
  './manifest.json',
  './assets/css/app.css',
  './assets/js/common.js',
  './assets/js/dashboard.js',
  './assets/js/name-replacer.js?v=16',
  './assets/js/word-replacer.js',
  './assets/images/dana-dashboard.jpg',
  './icons/icon-192.png?v=17',
  './icons/icon-512.png?v=17'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });
        return response;
      }))
      .catch(() => caches.match('./index.html'))
  );
});
