// Stage 1 offline support: app-shell-only cache. Does not touch Supabase
// data calls or the supabase-js CDN script — those are never intercepted
// below, by construction (only exact app-shell URLs are matched).

const CACHE_VERSION = 'storymap-shell-v1';

const APP_SHELL_PATHS = [
  './',
  'index.html',
  'manifest.json',
  'supabase-config.js',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const APP_SHELL_URLS = APP_SHELL_PATHS.map((p) => new URL(p, self.location.href).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!APP_SHELL_URLS.includes(event.request.url)) return; // let everything else (Supabase, CDN, fonts) hit the network normally

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
