// ═══════════════════════════════════════
// Service Worker — FINAL (No Admin Cache Issues)
// Wahat Sudr
// ═══════════════════════════════════════

const CACHE_VERSION = 'ws-v4'; // غير الرقم مع كل تحديث
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
      Promise.all(keys.map(k => caches.delete(k)))
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
    url.includes('supabase.co') // مهم عشان بيانات الأدمن
  );
}

function isAdminRequest(url) {
  return url.includes('/admin') || url.includes('admin');
}

// ================= STRATEGIES =================

// 🚨 HTML — Network Only (مفيش كاش نهائي)
async function networkOnly(request) {
  try {
    return await fetch(request, { cache: 'no-store' });
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

// 🖼 Images — Cache First
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

// 🔄 API — Network First (عشان الأدمن)
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

  // Skip Netlify internal
  if (url.includes('/.netlify/')) return;

  // 🚨 Admin requests — No Cache نهائي
  if (isAdminRequest(url)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // API (Supabase + Weather)
  if (isAPIRequest(url)) {
    event.respondWith(networkFirstAPI(event.request));
    return;
  }

  // Images
  if (isImageRequest(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 🚨 HTML pages (أهم حاجة)
  if (isHTMLRequest(event.request)) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  // JS / CSS — Network First خفيف
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
