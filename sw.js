// ══════════════════════════════════════════════
//  Service Worker — FIXED VERSION (Stable + No Cache Bugs)
// ══════════════════════════════════════════════

const CACHE_VERSION = 'ws-v2026-fixed-v2';
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

const SKIP_CACHE_DOMAINS = [
  'supabase',
  'googleapis.com/identitytoolkit',
  'google-analytics',
  'googletagmanager',
  'api.anthropic',
  'translate.google',
  'clarity.ms'
];

const STALE_REVALIDATE_DOMAINS = [
  'api.open-meteo.com',
  'wttr.in'
];

// ── Install ─────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate (يمسح كل القديم فعلياً) ─────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (!key.includes(CACHE_VERSION)) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Helpers ─────────────────────────────
function shouldSkipCache(url) {
  return SKIP_CACHE_DOMAINS.some(d => url.includes(d));
}

function isHTMLRequest(request) {
  return request.mode === 'navigate' ||
         request.headers.get('accept')?.includes('text/html');
}

function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i.test(url) ||
    url.includes('unsplash.com');
}

function isAPIRequest(url) {
  return STALE_REVALIDATE_DOMAINS.some(d => url.includes(d));
}

// ── Network First (للـ HTML فقط) ─────────
async function networkFirstHTML(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (e) {
    return caches.match('/offline.html');
  }
}

// ── Network First + Cache (static files) ─
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (e) {
    return caches.match(request);
  }
}

// ── Cache First (images) ─────────────────
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
  } catch (e) {
    return new Response('', { status: 404 });
  }
}

// ── Stale While Revalidate (API) ─────────
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(r => {
      if (r && r.ok) cache.put(request, r.clone());
      return r;
    })
    .catch(() => null);

  if (cached) return cached;

  const response = await fetchPromise;
  return response || new Response('{}', {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ── Fetch Handler (المهم جداً) ───────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = request.url;

  if (shouldSkipCache(url)) return;
  if (url.includes('/.netlify/')) return;

  // 🔥 أهم إصلاح: HTML دايماً fresh
  if (isHTMLRequest(request)) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  if (isAPIRequest(url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isImageRequest(url)) {
    event.respondWith(cacheFirstImages(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

// ── Background Sync ──────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(Promise.resolve());
  }
});

// ── Push Notifications ───────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'واحة سدر', {
      body: data.body || 'عرض جديد!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'wahat-notification',
      data: { url: data.url || '/' }
    })
  );
});

// ── Notification Click ───────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windows => {
      for (const client of windows) {
        if (client.url.includes('wahat-sudr') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
