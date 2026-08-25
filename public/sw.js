importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Config is injected at build time by vite.config.ts — do not edit %%placeholders%% manually.
var _FCM = {
  apiKey:            '%%VITE_FIREBASE_API_KEY%%',
  authDomain:        '%%VITE_FIREBASE_AUTH_DOMAIN%%',
  projectId:         '%%VITE_FIREBASE_PROJECT_ID%%',
  storageBucket:     '%%VITE_FIREBASE_STORAGE_BUCKET%%',
  messagingSenderId: '%%VITE_FIREBASE_MESSAGING_SENDER_ID%%',
  appId:             '%%VITE_FIREBASE_APP_ID%%',
};

if (_FCM.apiKey && _FCM.apiKey.indexOf('%%') === -1) {
  firebase.initializeApp(_FCM);
  var _msg = firebase.messaging();

  _msg.onBackgroundMessage(function (payload) {
    var n = payload.notification || {};
    var d = payload.data        || {};
    self.registration.showNotification(n.title || 'SlovakGO', {
      body:    n.body  || '',
      icon:    n.icon  || '/favicon.svg',
      badge:   '/favicon.svg',
      tag:     d.tag   || 'slovakgo',
      data:    { url: d.click_action || '/app/path', ...d },
      actions: [{ action: 'open', title: 'Відкрити' }],
    });
  });
}

const CACHE_VERSION = 'slovakgo-v9';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const AUDIO_CACHE   = `${CACHE_VERSION}-audio`;

// Never cache auth, billing or Vercel analytics — these must always be fresh or handled directly by the browser
const NO_CACHE_PATHS = ['/api/', '/_vercel/'];

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// ─── Install ───────────────────────────────────────────────────────────────────
// Precache app shell; stay in 'installed' state until SKIP_WAITING message
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────────
// Delete ALL caches from previous versions, then take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== AUDIO_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // ── Auth & billing: always network-only, never cache ──────────────────────
  if (NO_CACHE_PATHS.some((p) => url.pathname.startsWith(p))) {
    // Let the browser handle it natively — no SW interception
    return;
  }

  // ── Audio: cache-first for offline vocabulary playback ────────────────────
  if (
    request.destination === 'audio' ||
    /\.(mp3|ogg|wav|webm|aac)(\?|$)/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
    return;
  }

  // ── Navigation (HTML): network-first → cached shell → offline page ─────────
  // Network first ensures users get fresh HTML after every deploy.
  // Cached fallback keeps the app usable when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) cachePut(STATIC_CACHE, request, res.clone());
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/offline.html').then((r) => r ?? Response.error());
        })
    );
    return;
  }

  // ── Static assets (JS/CSS/fonts/icons): cache-first ───────────────────────
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function cachePut(cacheName, request, response) {
  // Only cache same-origin or CORS-opaque responses; skip error/redirect
  if (!response || response.status === 0) return;
  caches.open(cacheName).then((cache) => cache.put(request, response));
}

// ─── Background Sync ──────────────────────────────────────────────────────────
// Tells the app to drain its IndexedDB mutation queue (Chromium only)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SYNC_REQUESTED' }));
      })
    );
  }
});

// ─── Messages ──────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  // Sent by main.tsx when user clicks "Оновити" in the update banner
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
