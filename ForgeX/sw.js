/* ==========================================================================
   ForgeX Service Worker — sw.js
   Caches the static app shell (HTML/CSS/JS/assets) on first visit so the
   app keeps working offline afterwards. Data itself lives in LocalStorage,
   which is unaffected by this cache. Registered from index.html only.
   ========================================================================== */
var CACHE_NAME = 'forgex-shell-v1.0.0';
var SHELL_FILES = [
  'index.html', 'wizard.html', 'customers.html', 'projects.html', 'settings.html', 'report.html',
  'css/forgex-core.css', 'css/index.css', 'css/customers.css', 'css/projects.css', 'css/settings.css', 'css/report.css',
  'js/forgex-db.js', 'js/forgex-utils.js',
  'assets/logo1.svg', 'manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function () { /* offline-first best effort — ignore individual failures */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request).catch(function () { return cached; });
    })
  );
});
