// ════════════════════════════════════════
// Service Worker — FINAL STABLE VERSION
// ════════════════════════════════════════

const CACHE_VERSION = 'ws-v2026-final-v14';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGES_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE     = `${CACHE_VERSION}-api`;

// الملفات المهمة فقط
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// الدومينات اللي مش هنتدخل فيها
const SKIP_CACHE_DOMAINS = [
  'supabase',
  'googleapis.com/identitytoolkit',
  'google-analytics',
  'googletagmanager',
  'api.anthropic',
  'translate.google',
  'translate-pa.googleapis.com',
  'clarity.ms'
];

// APIs خفيفة
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

// ── Activate ────────────────────────────
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

function isHTML(request) {
  return request.mode === 'navigate';
}

function isImage(url) {
  return /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url) || url.includes('unsplash');
}

function isAPI(url) {
  return STALE_REVALIDATE_DOMAINS.some(d => url.includes(d));
}

// ── Fetch Handler ───────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const url = request.url;

  // تجاهل الحاجات الحساسة
  if (shouldSkipCache(url)) return;
  if (url.includes('/.netlify/')) return;

  // HTML = دايماً fresh
  if (isHTML(request)) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // API = Stale While Revalidate
  if (isAPI(url)) {
    event.respondWith(
      caches.open(API_CACHE).then(async cache => {
        const cached = await cache.match(request);

        const fetchPromise = fetch(request).then(res => {
          if (res && res.ok) {
            cache.put(request, res.clone());
          }
          return res;
        }).catch(() => null);

        return cached || fetchPromise || new Response('{}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Images = Cache First
  if (isImage(url)) {
    event.respondWith(
      caches.match(request).then(res => {
        return res || fetch(request).then(fetchRes => {
          if (!fetchRes || !fetchRes.ok) return fetchRes;

          return caches.open(IMAGES_CACHE).then(cache => {
            cache.put(request, fetchRes.clone());
            return fetchRes;
          });
        });
      })
    );
    return;
  }

  // Default = Network First
  event.respondWith(
    fetch(request).then(res => {
      if (res && res.ok) {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then(cache => {
          cache.put(request, clone);
        });
      }
      return res;
    }).catch(() => caches.match(request))
  );
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
