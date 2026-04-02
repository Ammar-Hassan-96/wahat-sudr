// ═══════════════════════════════════════
// Service Worker — Production Ready
// Wahat Sudr
// ═══════════════════════════════════════

const CACHE_VERSION = 'ws-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMAGE_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE    = `${CACHE_VERSION}-api`;

const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ================= INSTALL =================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ================= ACTIVATE =================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.includes(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ================= HELPERS =================
function isHTMLRequest(request) {
  return request.mode === 'navigate';
}

function isImageRequest(url) {
  return /\.(png|jpg|jpeg|webp|svg|gif|ico)$/i.test(url);
}

function isAPIRequest(url) {
  return url.includes('api.open-meteo.com') || url.includes('wttr.in');
}

// ================= STRATEGIES =================

// 🔥 Network First (HTML)
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());

    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Offline', { status: 503 });
  }
}

// 🖼 Cache First (Images)
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(IMAGE_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// 🔄 Stale While Revalidate (APIs)
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(res => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    fetchPromise;
    return cached;
  }

  const response = await fetchPromise;
  return response || new Response('{}', { status: 503 });
}

// ================= FETCH =================
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip Netlify internal
  if (url.includes('/.netlify/')) return;

  // API
  if (isAPIRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Images
  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML pages (IMPORTANT FIX)
  if (isHTMLRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static assets
  event.respondWith(networkFirst(event.request));
});

// ================= PUSH =================
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'Wahat Sudr', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      dir: 'rtl',
      data: { url: data.url || '/' }
    })
  );
});

// ================= NOTIFICATION CLICK =================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsArr => {
      for (const client of clientsArr) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
