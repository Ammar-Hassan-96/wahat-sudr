// ══════════════════════════════════════════════
// Service Worker — Wahat Sudr v11 (ULTRA STABLE)
// ══════════════════════════════════════════════

const CACHE_VERSION = 'ws-v11';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGES_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE     = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// ================= DOMAINS CONTROL =================

const SKIP_CACHE_DOMAINS = [
  'supabase',
  'google-analytics',
  'googletagmanager',
  'translate.google',
  'translate.googleapis',
  'translate-pa.googleapis',
  'gstatic.com',
  'clarity.ms'
];

const STALE_API_DOMAINS = [
  'api.open-meteo.com',
  'wttr.in'
];

// ================= INSTALL =================

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ================= ACTIVATE =================

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('ws-') && k !== STATIC_CACHE && k !== IMAGES_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ================= HELPERS =================

function shouldSkipCache(url) {
  return SKIP_CACHE_DOMAINS.some(d => url.includes(d));
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i.test(url)
    || url.includes('unsplash.com')
    || url.includes('img.youtube.com');
}

function isAPIRequest(url) {
  return STALE_API_DOMAINS.some(d => url.includes(d));
}

// ================= STRATEGIES =================

// Network First (HTML)
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offline = await caches.match('/offline.html');
    return offline || new Response('Offline', { status: 503 });
  }
}

// Cache First (Images)
async function cacheFirstImages(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(IMAGES_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// Stale While Revalidate (API)
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

  return fetchPromise || new Response('{}', { status: 503 });
}

// ================= FETCH =================

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip Netlify internals
  if (url.includes('/.netlify/')) return;

  // 🚨 Skip caching for sensitive / dynamic services
  if (shouldSkipCache(url)) return;

  // API
  if (isAPIRequest(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Images
  if (isImageRequest(url)) {
    event.respondWith(cacheFirstImages(event.request));
    return;
  }

  // HTML & باقي الملفات
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
