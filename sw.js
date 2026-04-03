// ═══════════════════════════════════════
// Service Worker — FINAL STABLE (Production Ready)
// Wahat Sudr
// ═══════════════════════════════════════

const CACHE_VERSION = 'ws-v6'; // غير الرقم مع أي تحديث مهم
const IMAGE_CACHE  = `${CACHE_VERSION}-images`;
const API_CACHE    = `${CACHE_VERSION}-api`;

const OFFLINE_URL = '/offline.html';

// ================= INSTALL =================
self.addEventListener('install', event => {
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
  return (
    url.includes('api.open-meteo.com') ||
    url.includes('wttr.in') ||
    url.includes('supabase.co')
  );
}

function isAdminRequest(url) {
  return url.includes('/admin');
}

// 🚨 مهم جداً: استثناء Google Translate
function isGoogleTranslate(url) {
  return (
    url.includes('translate.google.com') ||
    url.includes('translate.googleapis.com') ||
    url.includes('gstatic.com')
  );
}

// ================= STRATEGIES =================

// HTML — Network Only (بدون كاش)
async function networkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

// Images — Cache First
async function cacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const res = await fetch(request);
    cache.put(request, res.clone());
    return res;
  } catch {
    return new Response('', { status: 404 });
  }
}

// API — Network First
async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return await cache.match(request) || new Response('{}', { status: 503 });
  }
}

// ================= FETCH =================
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Skip Netlify internals
  if (url.includes('/.netlify/')) return;

  // 🚨 Google Translate — بدون تدخل
  if (isGoogleTranslate(url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 🚨 Admin — بدون كاش نهائي
  if (isAdminRequest(url)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // API
  if (isAPIRequest(url)) {
    event.respondWith(networkFirstAPI(event.request));
    return;
  }

  // Images
  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML
  if (isHTMLRequest(event.request)) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  // JS / CSS — Network First بسيط
  event.respondWith(
    fetch(event.request)
      .then(res => res)
      .catch(() => caches.match(event.request))
  );
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
