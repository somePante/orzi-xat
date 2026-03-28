// ORZI XAT — Service Worker
// Handles offline caching so the app shell loads even without internet.

const CACHE_NAME = 'orzi-xat-v1';

// Assets to cache on install (the app shell)
const SHELL_ASSETS = [
  '/orzi-xat/',
  '/orzi-xat/index.html',
  '/orzi-xat/manifest.json',
  '/orzi-xat/icon-192.png',
  '/orzi-xat/icon-512.png'
];

// ── INSTALL: cache the app shell ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ORZI SW] Caching app shell');
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: network-first for Supabase API, cache-first for static assets ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for Supabase (real-time data)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.io')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Always go to network for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (app shell, CDN scripts)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: serve index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/orzi-xat/index.html');
        }
      });
    })
  );
});
