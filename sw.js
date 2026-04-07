// ══════════════════════════════════════════════
//  Service Worker — واحة سدر السياحية
//  v2026-04-06-v16 (Network-First + Reliable Offline)
// ══════════════════════════════════════════════

const CACHE_VERSION = 'ws-v2026-04-06-v16';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const IMAGES_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE     = `${CACHE_VERSION}-api`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-144x144.png'
];

const SKIP_CACHE_DOMAINS = [
  'supabase', 'googleapis.com/identitytoolkit', 'google-analytics',
  'googletagmanager', 'api.anthropic', 'translate.google', 'clarity.ms'
];
const STALE_REVALIDATE_DOMAINS = ['api.open-meteo.com', 'wttr.in'];

// ── Install: pre-cache essential files ───────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches + take control ─
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('ws-') && k !== STATIC_CACHE && k !== IMAGES_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // تأخير بسيط قبل الإشعار — يضمن إن الـ clients اتحطت تحت الـ SW الجديد
        setTimeout(() => {
          self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION }));
          });
        }, 1000);
      })
  );
});

// ── Helpers ───────────────────────────────────
function shouldSkipCache(url) {
  return SKIP_CACHE_DOMAINS.some(d => url.includes(d));
}
function isImageRequest(url) {
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i.test(url) ||
    url.includes('unsplash.com') || url.includes('img.youtube.com');
}
function isAPIRequest(url) {
  return STALE_REVALIDATE_DOMAINS.some(d => url.includes(d));
}

// ── Network-First: always try server, cache as backup ──
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // For HTML requests, show offline page
    const accept = request.headers.get('accept') || '';
    if (accept.includes('text/html')) {
      const offline = await caches.match('/offline.html');
      if (offline) return offline;
    }
    return new Response('غير متاح', { status: 503 });
  }
}

// ── Cache-First: for images ──────────────────
async function cacheFirstImages(request) {
  try {
    // ✅ تجاهل أي request مش http/https (زي chrome-extension)
    if (!request.url.startsWith('http')) {
      return fetch(request);
    }

    // ✅ تأكد إنه request خاص بالصور فقط
    if (request.destination !== 'image') {
      return fetch(request);
    }

    // 🔎 شوف لو موجود في الكاش
    const cached = await caches.match(request);
    if (cached) return cached;

    // 🌐 هات من الشبكة
    const response = await fetch(request);

    // ✅ تحقق إن response صالح
    if (response && response.ok) {
      const cache = await caches.open(IMAGES_CACHE);

      // ✅ خزّن نسخة في الكاش
      await cache.put(request, response.clone());
    }

    return response;

  } catch (e) {
    console.warn('[SW] Image cache error:', e);

    // ❌ fallback لو فشل
    return new Response('', { status: 404 });
  }
}

// ── Stale-While-Revalidate: for weather API ──
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(r => { if (r && r.ok) cache.put(request, r.clone()); return r; })
    .catch(() => null);
  if (cached) { fetchPromise; return cached; }
  const response = await fetchPromise;
  return response || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
}

// ── Main fetch handler ───────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (shouldSkipCache(url)) return;
  if (url.includes('/.netlify/')) return;
  if (isAPIRequest(url)) { event.respondWith(staleWhileRevalidate(event.request)); return; }
  if (isImageRequest(url)) { event.respondWith(cacheFirstImages(event.request)); return; }
  event.respondWith(networkFirst(event.request));
});

// ── Background sync + Push ───────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings') event.waitUntil(Promise.resolve());
});
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'واحة سدر', {
      body: data.body || 'عرض جديد!', icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png', dir: 'rtl', lang: 'ar',
      tag: data.tag || 'wahat-notification', data: { url: data.url || '/' }
    })
  );
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(wc => {
      for (const c of wc) { if (c.url.includes('wahat-sudr') && 'focus' in c) return c.focus(); }
      return clients.openWindow(event.notification.data?.url || '/');
    })
  );
});
