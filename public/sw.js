const CACHE_VERSION = 'v5';
const STATIC_CACHE = `slovakgo-static-${CACHE_VERSION}`;
const API_CACHE    = `slovakgo-api-${CACHE_VERSION}`;
const AUDIO_CACHE  = `slovakgo-audio-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg'
];

// Install: precache app shell; wait in 'installed' state until client sends SKIP_WAITING
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

// Activate: delete stale caches from previous versions, claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE && k !== AUDIO_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: route-based caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // API: network-first with cached fallback
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Audio files: cache-first for offline vocabulary playback
  if (
    request.destination === 'audio' ||
    /\.(mp3|ogg|wav|webm|aac)(\?|$)/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
    return;
  }

  // Navigation: serve cached shell, fall back to offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((cached) =>
        cached ||
        fetch(request)
          .then((res) => {
            cachePut(STATIC_CACHE, request, res.clone());
            return res;
          })
          .catch(() => caches.match('/offline.html').then((r) => r || Response.error()))
      )
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cachePut(cacheName, request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) cachePut(cacheName, request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

function cachePut(cacheName, request, response) {
  caches.open(cacheName).then((cache) => cache.put(request, response));
}

// Background Sync: notify app clients to drain the queue (Chromium only)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

// Message from app: SKIP_WAITING forces new SW to take over immediately
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
