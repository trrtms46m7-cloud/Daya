'use strict';

// Bump this version whenever any app-shell file changes.
const CACHE_PREFIX = `repair-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL = [
  './', './index.html', './style.css', './app.js', './pwa.js', './config.js',
  './manifest.webmanifest', './vendor/supabase-2.119.0.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
].map(path => new URL(path, self.registration.scope).href);
const SHELL_URLS = new Set(SHELL);

self.addEventListener('install', (event) => {
  // All files must be available before this worker can replace an older version.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // Only public, static app-shell files are cached. API reads and writes go
  // directly to the network; no request contents or report records are stored.
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  url.search = '';
  if (!SHELL_URLS.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(url.href)) || fetch(event.request);
  })());
});
