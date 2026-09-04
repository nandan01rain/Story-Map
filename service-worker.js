// Stage 1 offline support: app-shell-only cache. Does not touch Supabase
// data calls or the supabase-js CDN script — those are never intercepted
// below, by construction (only exact app-shell URLs are matched).

const CACHE_VERSION = 'storymap-shell-v8';

const APP_SHELL_PATHS = [
  './',
  'index.html',
  'manifest.json',
  'supabase-config.js',
  // The braid, loaded in an iframe by index.html. Without it in the shell the graph is the
  // one surface that breaks offline while everything around it works, which reads as a bug
  // rather than as a missing network.
  //
  // Both query forms are listed because the host appends the resolved theme, and a cache
  // entry for the bare URL does not answer a request for braid.html?theme=day.
  'braid.html',
  'braid.html?theme=night',
  'braid.html?theme=day',
  // List view's background. It used to be a 209 KB base64 data URI inside index.html -- the
  // same image twice, since the map had its own copy -- which meant it was re-downloaded
  // with the document on every deploy and could never be cached separately. As a file it is
  // fetched once and revalidated like anything else.
  'assets/list-bg.jpg',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

const APP_SHELL_URLS = APP_SHELL_PATHS.map((p) => new URL(p, self.location.href).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL_URLS)).then(() => self.skipWaiting())
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

  // Network-first for the app shell, falling back to cache when offline. This used to be
  // cache-first, which meant a returning user kept running whatever index.html was cached
  // at install time and never saw a deploy until CACHE_VERSION happened to change — the
  // cause of repeatedly "not seeing" shipped changes. Offline still works: the fetch
  // rejects and we serve the cached copy.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
