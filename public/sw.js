const CACHE = 'field-shell-v4';
const root = self.registration.scope;
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-32.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
].map(path => new URL(path.replace(/^\//, ''), root).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('field-shell-') && key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.headers.has('Authorization') || url.origin !== self.location.origin || !url.href.startsWith(root)) return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    if (response.ok) event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match(root) : undefined) || Response.error()));
});
