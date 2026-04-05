// ══════════════════════════════════════════════════════════
//  Image Proxy — واحة سدر
//  يجيب الصور من أي موقع عبر سيرفرنا عشان يتجنب الـ CORS
//  وHotlink Protection على Android Chrome
//  الاستخدام: /img-proxy?url=https://example.com/photo.jpg
// ══════════════════════════════════════════════════════════

export default async (req) => {
  const reqUrl = new URL(req.url);
  const imageUrl = reqUrl.searchParams.get('url');

  // تحقق إن في URL
  if (!imageUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // تحقق إن الـ URL صحيح
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  // فقط http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return new Response('Only http/https URLs allowed', { status: 400 });
  }

  try {
    // جيب الصورة من الموقع الأصلي مع browser-like headers
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': parsedUrl.origin + '/',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (!response.ok) {
      return new Response('Image fetch failed: ' + response.status, { status: 502 });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // تأكد إنه فعلاً image
    if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
      return new Response('Not an image', { status: 415 });
    }

    const imageData = await response.arrayBuffer();

    return new Response(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
        'X-Proxy': 'wahat-sudr-img-proxy',
      },
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 502 });
  }
};

export const config = {
  path: '/img-proxy',
};
