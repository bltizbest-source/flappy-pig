const CACHE_NAME = 'flying-piggy-v2';
const APP_FILES = [
  'index.html',
  'style.css',
  'game.js',
  'favicon.svg',
  'apple-touch-icon.png',
  'piggy-icon-192.png',
  'piggy-icon-512.png',
  'site.webmanifest'
].map(file => new URL(file, self.registration.scope).href);

const INDEX_URL = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names
          .filter(name => name.startsWith('flying-piggy-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          if (response.ok) {
            event.waitUntil(
              caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy))
            );
          }
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
